/* recon_trk.c — reconstruction of the "tracker/structs" zone (Carrera Digital, ATmega16)
 * Toolchain: avr-gcc 4.8.1 (container gcc48), flags: -Os -fno-tree-loop-optimize
 *   (-fno-tree-loop-optimize is required: without it GCC 4.8 reorders blocks
 *    differently from the firmware, the `if (t->seen)` tests no longer branch out with cpse+rjmp)
 * Symbolic method: globals as extern, resolved at link (relocs masked in scoring).
 *
 *   car_table_reset     @0x13DC 112 bytes — byte-exact (scorer 112/112, link 112/112) ✅
 *   buttons_scan @0x144C 140 bytes — byte-exact at the pin 5.4.0+Atmel3.6.0 (scorer 140/140, link 140/140) ✅
 *       (the empty asm barrier `"r"(f)` is REQUIRED: without it GCC places `lds r18`
 *        BEFORE `ldi r25,1`, while the firmware has the reverse order.
 *        The first test must be written `b = 0; if (!(PINC & _BV(4))) b = 5;` (or the
 *        ternary `b = (PINC & _BV(4)) ? 0 : 5;`): the if/else form gives sbis+swapped ldi.
 *        Dump with `avr-objdump -dzr`: without -z objdump elides the NOP runs ("...") and
 *        score.py then sees 76 bytes instead of 140.)
 *   rank_compute_a   @0x12AE 150 bytes — byte-exact at the pin (scorer 150/150, link 150/150) ✅
 *   rank_compute_b   @0x1344 152 bytes — byte-exact at the pin (scorer 152/152, link 152/152) ✅
 *       (both: inner loop indexed `u = &cars[j]` — see the comments on each function)
 */
#include <stdint.h>
#include <avr/io.h>

/* --- car structure: 35 bytes, base 0x02BE --- */
struct car {
    int16_t  pos;      /* 0x00 : relative position (signed)    */
    uint8_t  tick_snapshot[4];   /* 0x02 : copy of global counter        */
    uint32_t t06;      /* 0x06 : current 32-bit lap timer      */
    uint32_t t0a;      /* 0x0a : 32-bit time (default 86'400'000) */
    uint32_t t0e;      /* 0x0e : 32-bit time                   */
    uint32_t min_gap0;      /* 0x12 : 0xFFFF by default             */
    uint32_t min_gap1;      /* 0x16 : 0xFFFF by default             */
    uint32_t min_gap2;      /* 0x1a : 0xFFFF by default             */
    uint8_t  armed_chan;      /* 0x1e                                  */
    uint8_t  last_chan;      /* 0x1f                                  */
    uint8_t  rank;      /* 0x20 : computed counter/position     */
    uint8_t  rank_sent;      /* 0x21 : previous value of rank         */
    uint8_t  seen;      /* 0x22 : active car                    */
};

extern struct car cars[8];       /* 0x02BE */
extern volatile uint32_t tick_clock32;   /* 0x01B0 */
extern volatile uint8_t  cfg_btn_enable;   /* 0x01A2 */
extern volatile uint8_t  btn_b0_held;   /* 0x01B4 */
extern volatile uint8_t  btn_c6_held;   /* 0x01B5 */

/* ===================== car_table_reset @ 0x13DC (112 bytes) ===================== */
void car_table_reset(void)
{
    tick_clock32 = 0;
    struct car *p;
    for (p = cars; p != cars + 8; p++) {
        p->rank = 8;
        p->rank_sent = 8;
        p->seen = 0;
        p->pos = 0;
        p->t0a = 86400000;
        p->t0e = 0;
        p->t06 = 0;
        p->armed_chan = 0;
        p->last_chan = 0;
        p->min_gap0 = 0xFFFF;
        p->min_gap1 = 0xFFFF;
        p->min_gap2 = 0xFFFF;
    }
}

/* ===================== rank_compute_a @ 0x12AE (150 bytes) ===================
 * MATCHED at the pin (5.4.0+Atmel3.6.0, plain -Os): scorer 150/150 + link 150/150.
 * Two things decide it (the register allocation was already right, the BLOCK LAYOUT was not):
 *  - the inner loop indexes the table (`u = &cars[j]`) instead of walking a second pointer
 *    (`for (u = cars, j = 0; ...; u++)`): that pointer form makes bb-reorder rotate the loop
 *    (test at the bottom, entered by an rjmp, 152 B); the index form keeps the test on top;
 *  - the leaf conditions form ONE expression with a single `t->rank--`: with five separate
 *    `rank--` statements the compare branches get the opposite polarity (144/150 at link).
 */
void rank_compute_a(uint8_t n)
{
    uint8_t i, j;
    struct car *t, *u;
    for (t = cars, i = 0; i != n; i++, t++) {
        t->rank = n;
        if (t->seen != 0) {
            for (j = 0; j != n; j++) {
                u = &cars[j];
                if (i != j) {
                    if (u->seen == 0 ||
                        (t->pos == u->pos
                             ? (t->last_chan == u->last_chan ? t->t06 <= u->t06
                                                              : u->last_chan < t->last_chan)
                             : u->pos < t->pos))
                        t->rank--;
                }
            }
        }
    }
}

/* ===================== rank_compute_b @ 0x1344 (152 bytes) ===================
 * MATCHED at the pin: scorer 152/152 + link 152/152. Same inner-loop form (`u = &cars[j]`);
 * here the nested if/else with one `rank--` per leaf is the right one (the single-expression
 * form of rank_compute_a gives 192 B). */
void rank_compute_b(uint8_t n)
{
    uint8_t i, j;
    struct car *t, *u;
    for (t = cars, i = 0; i != n; i++, t++) {
        t->rank = n;
        if (t->seen != 0) {
            for (j = 0; j != n; j++) {
                u = &cars[j];
                if (i != j) {
                    if (u->seen == 0) {
                        t->rank--;
                    } else if (t->pos == 0) {
                        if (u->pos == 0 && t->t0e < u->t0e) t->rank--;
                    } else {
                        if (u->pos == 0 || t->t0a < u->t0a) t->rank--;
                    }
                }
            }
        }
    }
}

/* =================== buttons_scan @ 0x144C (140 bytes) =================== */
#define NOP16() __asm__ __volatile__("nop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\t" \
                                     "nop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\tnop\n\t")

uint8_t buttons_scan(void)
{
    uint8_t b, f;
    PORTC |= _BV(0);
    NOP16();
    b = 0;                              /* NOT `if (..) b = 5; else b = 0;`: at the pin that gives sbis + swapped ldi */
    if (!(PINC & _BV(4))) b = 5;
    if (!(PINC & _BV(5))) b = 6;
    if (!(PINC & _BV(6))) b = 7;
    if (!(PINB & _BV(0))) b = 8;
    PORTC &= (uint8_t)~_BV(0);
    NOP16();
    if (!(PINC & _BV(4))) b = 1;
    if (!(PINC & _BV(5))) b = 2;
    if (!(PINC & _BV(6))) {
        f = 1;
        __asm__ __volatile__("" : : "r"(f));   /* keeps the order of ldi r25,1 / lds */
        if (cfg_btn_enable == 0) f = 0;
    } else
        f = 0;
    btn_c6_held = f;
    if (!(PINB & _BV(0))) {
        f = 1;
        __asm__ __volatile__("" : : "r"(f));   /* same (0x1B4) */
        if (cfg_btn_enable == 0) f = 0;
    } else
        f = 0;
    btn_b0_held = f;
    return b;
}

/* ============================================================================
 * recon_man.c — CONTROLLER batch (agent sub-2) — FINAL VERSION
 * Target: Carrera Digital V339 firmware (ATmega16) — pinned avr-gcc 5.4.0+Atmel3.6.0 -Os
 * Symbolic method: globals/symbols as `extern` -> relocated at link
 * (bytes masked in .o scoring, verified byte-exact by link_man.ld).
 * ==========================================================================*/
#include <stdint.h>

/* ---------------- SRAM globals (addresses resolved at link) ------------ */
extern uint8_t *event_ring_rd;      /* 0x017E : 16-bit pointer              */
extern uint8_t *event_ring_wr;      /* 0x00DB : 16-bit pointer              */
extern uint8_t  slots[];       /* 0x00E9 : 8 structs of 6 bytes (48)   */

/* ==========================================================================
 * 1) 0x01A6 — reset: 8 structs x 6 bytes, byte 0 set to 8, + 2 pointers   [40 bytes]  ✔ MATCHED
 *    scorer 40/40  +  LINK 40/40 (bytes identical to the firmware)
 *    Idioms: symbolic bound `slots + 48` (=> alternative (d,"s") of
 *    *cmphi: ldi r25,hi8(sym); cpi r30,lo8(sym); cpc r31,r25) and
 *    `!=` comparison (BRNE `d1 f7`) rather than `<` (BRCS `d0 f3`) — invisible
 *    to .o scoring (reloc branch = 2 masked bytes) but decisive at link.
 * ==========================================================================*/
void event_ring_reset(void)
{
    uint8_t *p;
    for (p = slots; p != slots + 48; p += 6)
        p[0] = 8;
    event_ring_rd = (uint8_t *)0x00E9;
    event_ring_wr = (uint8_t *)0x00E9;
}

/* ==========================================================================
 * 2) 0x0140 — beep_queue_push(a,b): queue (a,b) in the 32 x 2-byte ring @0x94 when a
 *    note is playing, otherwise start it: ticks = (b*10)/15 + buzzer_set_mode(a)
 *    [102 bytes] MATCHED at the pin (5.4.0+Atmel3.6.0): scorer 102/102 + link 102/102.
 *    Forms that matter:
 *      - beep_ticks_left is ONE 16-bit var (lds r24/lds r25/or r24,r25 + sts hi,sts lo);
 *        two uint8 vars load the high byte first.
 *      - the queue is a symbolic array (`subi r30,lo8(-queue)` after the doubling).
 *      - the 2nd store recomputes its base pointer in a separate statement
 *        (`q = queue + ((wr & 0x1F) << 1); q[1] = b;`): a single `queue[2*i + 1]`
 *        folds the +1 into the symbol (subi lo8(-(queue+1)) + `st Z`, 100/102 at link)
 *        instead of the target's `std Z+1`.
 *      - SIGNED division /15 = __divmodhi4 (quotient r23:r22); `a` kept in r18 across
 *        the call; tail-call buzzer_set_mode.
 * ==========================================================================*/
extern volatile uint8_t cfg_sound_enable;    /* 0x019C */
extern volatile uint8_t beep_q_wr;           /* 0x00D5 : index (mod 32)      */
extern volatile uint16_t beep_ticks_left;    /* 0x00D7 : remaining ticks of the note (16-bit) */
extern volatile uint8_t beep_queue[];        /* 0x0094 : 32 x {mode, duration} */
extern void buzzer_set_mode(uint8_t m);      /* 0x0122                       */

void beep_queue_push(uint8_t a, uint8_t b)
{
    if (cfg_sound_enable == 0)
        return;
    if (beep_ticks_left != 0) {
        volatile uint8_t *q = beep_queue + ((beep_q_wr & 0x1F) << 1);
        q[0] = a;
        q = beep_queue + ((beep_q_wr & 0x1F) << 1);
        q[1] = b;
        beep_q_wr++;
    } else {
        beep_ticks_left = (b * 10) / 15;
        buzzer_set_mode(a);
    }
}

/* ==========================================================================
 * 3) 0x01EA — send_buffer: checksum up to '$'         [24 bytes] MATCHED at the pin
 *    (5.4.0+Atmel3.6.0): scorer 24/24 + link 24/24 with this plain `while` form.
 *    (The older 4.8.1 attempts were stuck on the sum/temp register pairing R25/R24;
 *    see reply_checksum_forms.c for the other forms.)
 * ==========================================================================*/
void reply_append_checksum(char *p)
{
    uint8_t sum = 0;
    while (p[1] != '$') {
        sum += *p;
        p++;
    }
    *p = (char)((sum & 0x0F) | '0');
}

/* ==========================================================================
 * 4) 0x0B44 — sum_bytes(p,n): raw checksum                     [24 bytes] MATCHED
 *    Matching form at the pin (5.4.0+Atmel3.6.0, 24/24 + link 24/24): the loop
 *    pointer is a SEPARATE induction variable `q` of a `for`, with the bound
 *    `p + n` written in the loop condition:
 *      target: movw Z,r24 | ldi r24,0 | movw r18,r30 | add r18,r22 | adc r19,r1
 *    (sum=0 is emitted BEFORE `end = q + n`, which is then computed from Z).
 *    The `end = p + n; while (p < end)` forms all give `end` before the init of
 *    sum and copy it from r24 (16/24) — see sum_bytes_forms.c.
 * ==========================================================================*/
uint8_t sum_bytes(uint8_t *p, uint8_t n)
{
    uint8_t sum = 0;
    for (uint8_t *q = p; q < p + n; q++)
        sum += *q;
    return sum;
}

/* ==========================================================================
 * 5) 0x0A8E — controller pulse decoder                  [116 bytes] 116/116
 *    Semantics: if ctl_rx_bitcount is 9 or 10: b = (ctl_rx_word&1)*4 if 10, else
 *      ctl_rx_word*=2, b=0; then ((uint8_t*)0x180)[ ((ctl_rx_word>>6)&3) | b ] =
 *      0x80 | ((ctl_rx_word<<3)&0x10) | ((ctl_rx_word>>2)&0x0F); bitcount=0, word=0.
 *    Form at the pin (5.4.0+Atmel3.6.0, scorer 116/116 and link 116/116): the three reads
 *    of ctl_rx_word come in the target order (>>2 operand first, kept across the mul; then
 *    the mul operand; then the index). The value is pinned with empty asms (TER would sink
 *    it to the store), and the index is sign-extended into a pinned pointer so the
 *    `| 0x80` lands between the sign extension and the table add, as in the target.
 *    The mul operand w is read into its own variable and is still live after the mul: an
 *    empty asm reads w and the product m together, so the product cannot take w's register.
 *    That gives the target's `lds r25 ; ldi r21,8 ; mul r25,r21`. (A "d" constraint on w,
 *    or an explicit register variable, did not give it on their own.)
 * ==========================================================================*/
extern volatile uint8_t ctl_rx_bitcount;    /* 0x0188 */
extern volatile uint8_t ctl_rx_word;    /* 0x018D */

void ctl_pulse_decode(void)
{
    uint8_t b;
    if (ctl_rx_bitcount == 9 || ctl_rx_bitcount == 10) {
        if (ctl_rx_bitcount == 10)
            b = (uint8_t)((ctl_rx_word & 1) * 4);
        else {
            ctl_rx_word = (uint8_t)(ctl_rx_word * 2);
            b = 0;
        }
        {
            /* First read of ctl_rx_word: its >>2 operand, kept in a register across the mul. */
            uint8_t hi = ctl_rx_word;
            /* Second read: the mul operand. The empty asm reads w and the product m together: the mul
             * is computed before it, w is still live after the mul, and dead after the asm (so the >>2
             * temp can take w's register, as in the target). */
            uint8_t w = ctl_rx_word;
            int m = ((w << 3) & 0x10);
            __asm__ __volatile__("" : : "r"(w), "r"(m));
            /* Value computed before the index read; the empty asm keeps it there (TER would sink it). */
            int val = m | ((hi >> 2) & 0x0F);
            __asm__ __volatile__("" : "+a"(val));
            __asm__ __volatile__("" : : "r"(hi));   /* hi stays alive across the shift: forces the copy */
            int8_t i = (int8_t)(((ctl_rx_word >> 6) & 3) | b);
            /* Sign-extended index as a pinned pointer; the | 0x80 is pinned after it. */
            uint8_t *q = (uint8_t *)(int)i;
            __asm__ __volatile__("" : "+e"(q));
            uint8_t v = (uint8_t)(val | 0x80);
            __asm__ __volatile__("" : "+a"(v));
            *(q + 0x0180) = v;
        }
        ctl_rx_bitcount = 0;
        ctl_rx_word = 0;
    }
}

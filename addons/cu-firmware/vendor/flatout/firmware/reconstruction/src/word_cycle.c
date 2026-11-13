/* word_cycle.c — word_cycle_step @ flash 0x2A4E (1340 bytes, ends with `ret` at 0x2F88)
 * Carrera Digital V339 — ATmega16 — avr-gcc 5.4.0+Atmel3.6.0 -Os -mmcu=atmega16
 * ==========================================================================
 * SCORE: 1340/1340, size exact — byte-exact (score.py + linkcheck.py).
 *
 * EXTENT: 0x2A4E..0x2F8A is 1340 bytes (0x53C), not the 1414 of functions.tsv: the
 * `ret` at 0x2F88 is followed directly by rail_cycle_service (0x2F8A), and there is no
 * other function inside. (The 1414 was the old merged row; see glossary open question 5.)
 * The function has THREE exits: the common epilogue + `ret` (cases 6, 8, 9, default) and
 * two tail calls with their own epilogue: `jmp 0x0754` (slot_word_compose, controllers) and
 * `jmp 0x1C76` (state_machine_run, word 7). So the state machine runs once per word cycle,
 * from word 7, and its `ret` (0x2A4C) returns to rail_cycle_service.
 *
 * WHAT IT DOES. Called once per word of the 10-word cycle by rail_cycle_service. It
 *   1. advances the cycle position: cycle_idx = cycle_next_table[cycle_idx] (0,4,1,5,2,8,3,6,7,9),
 *      0 if out of range; the NEW position id selects the word to prepare:
 *   2. id 0..5, the six controllers: reads the controller (serial 'C' table, else the byte
 *      decoded by the INT0/INT2 ISRs, else the ADC + PINB directly), resets the idle timer
 *      on activity, flags a new button press, then runs the FUEL logic (tank, level display
 *      pushed to the inject queue, throttle limit when empty / when armed) and finally
 *      stores throttle+switch in the slot and tail-calls slot_word_compose(id, unk_217);
 *   3. id 6: the pace/programming word (slot 6): pops the inject queue (word + repeat
 *      count) or else broadcasts the status nibble of the slot pace_idx (round robin 0..5);
 *   4. id 7: blinks bit 3 of slot 7's throttle byte, composes it, then runs the state machine;
 *   5. id 8, 9: slot 8/9 words: a bitmap of the slots with a non-zero throttle (6 bits) with
 *      the count of those slots on top; word 9 sends reply_seen_mask instead when non-zero.
 *
 * C FORMS THAT MATTER (pin 5.4.0+Atmel3.6.0, see docs/method.md):
 *   - NO local pointer to ctl_rx_table: `volatile uint8_t *p = &ctl_rx_table[i]` takes the
 *     Y pair (r28:r29) for the pointer and pushes id/sw to r16/r17. Writing ctl_rx_table[i]
 *     four times gives the target's allocation (id r29, c/sw r28, t r16:r17, p r16:r17).
 *   - `int i = id;` next to `uint8_t id`: i feeds the shift counts, the `<< 4` / `<< 5`
 *     loops and the table addresses (16-bit loops), id feeds `>> id` and the call arguments.
 *   - the two controller-read arms are two separate `gas = adc(..); sw = PINB >> ..` copies
 *     (gotos build the CFG: id<2 enters arm A, id 2..3 with flags==0 too, id 4..5 with
 *     flags!=0 is arm B); GCC tail-merges the shift and the `& 1`.
 *   - declaration order `uint8_t c, sw, thr, edge;` fixes the order of the PHI copies
 *     in the "absent controller" block (`thr = 0; sw = 1`): target `mov r13,r1; ldi r28,1`.
 *   - the press flag: `edge = 1` goes to the join through a goto, the zero cases fall into
 *     ONE shared block that holds an EMPTY asm. Without the asm GCC's phiopt turns
 *     `edge = (prev != 0)` into a bool (`ldi r24,1` hoisted before the test); the asm keeps
 *     the zero block non-empty so both constants stay separate blocks (like the target).
 *   - `ctl_table_stamp--; if (ctl_table_stamp == 0)` and `inject_repeat[tail]--; if (...== 0)`:
 *     volatile, the test re-reads (`--v == 0` would not).
 *   - `if (gas == 0) { if (sw == 0) {...} sw = 1; }`: the `ldi r28,1` after the refuel
 *     block is a real assignment (the button is hidden from the word while stopped).
 *   - case 7: `if (v & 8) v = 0; else v = 8;` then `if (sm_state != 0x17) v |= 4; else v |= 7;`
 *     (the ternary form `v |= x ? 7 : 4` gives a different sequence).
 *   - case 8/9 loop: `uint8_t cnt = 0, acc = 0, w; int n;` — the declaration order sets the
 *     order of the three `ldi` of the loop init (n, acc, cnt); `int n` gives the 16-bit
 *     index (`movw r30,r20`, borrow test `subi/sbc/brcc`); `w` is uint8_t (high byte dropped).
 *
 * Structures: slot16_t @0x021C (16 bytes per slot, same layout as in state_machine.c).
 * All global accesses are external symbols (addresses resolved at link, see linkcheck).
 */
#include <stdint.h>
#include <string.h>
#include <avr/io.h>

/* The 16-byte slot records (10 words: 6 controllers + 4 special words). */
typedef struct {
    uint8_t  throttle;      /* +0  : 4 throttle bits G3..G0 (controllers); slot 7: blink/flags */
    uint8_t  sw;            /* +1  : switch bit, 0 = pressed */
    uint8_t  status;        /* +2  : low 3 bits = displayed tank level 0..7, bit 3 = empty/armed */
    uint8_t  press_edge;    /* +3  : button newly pressed this cycle (read by state 24: tank setting) */
    uint8_t  throttle_alt;  /* +4  : second pair (slot_word_compose which != 0) */
    uint8_t  sw_alt;        /* +5  */
    uint8_t  bit_count;     /* +6  : number of bits of the word (9, 12 for slot 6, 7 or 8 for 8/9) */
    uint16_t period;        /* +7  : OCR1A reload of this word */
    uint16_t fuel;          /* +9  : remaining fuel in ticks (cmd J / prog_buf: full tank) */
    uint8_t  tank;          /* +11 : tank level 0..14 (setting / display) */
    uint8_t  reply_flag;    /* +12 : set to 1 by rail_reply_rx_step (car answered, code 1) */
    uint8_t  reply_acc;     /* +13 : sum of the throttle above 5 while reply_flag == 1 */
    uint16_t word;          /* +14 : composed word, loaded into the shifter */
} slot16_t;

/* ---------- SRAM globals (addresses set by linker) ---------- */
extern volatile uint8_t  cycle_idx;        /* 0x01BA : position in the 10-word cycle */
extern uint8_t           cycle_next_table[]; /* 0x0062 : 0,4,1,5,2,8,3,6,7,9 (.data) */
extern uint8_t           ctl_cmd_table[];  /* 0x00DD : serial 'C' command table (8 B cleared on timeout) */
extern volatile uint8_t  ctl_rx_table[];   /* 0x0180 : bytes decoded by the INT0/INT2 ISRs */
extern volatile uint8_t  ctl_edge_flags;   /* 0x018E : which controller bank answers (ids 2,3 / 4,5) */
extern volatile uint8_t  ctl_table_stamp;  /* 0x017D : countdown (0x3C from cmd C) to clear the table */
extern uint8_t           unk_217;          /* 0x0217 : `which` argument of slot_word_compose */
extern uint8_t           unk_211;          /* 0x0211 : one-shot flag of the tank display push */
extern uint8_t           ta_off_flag;      /* 0x020F */
extern uint8_t           btn_c6_held;      /* 0x01B5 */
extern uint8_t           btn_b0_held;      /* 0x01B4 */
extern volatile uint8_t  car_arm_mask;     /* 0x01B7 : per-address mask */
extern volatile uint8_t  reply_seen_mask;  /* 0x0401 : bit per replying word position */
extern uint8_t           sm_state;         /* 0x0218 : state machine state (0x17 = 23) */
extern volatile uint8_t  pace_idx;         /* 0x03DC : slot 0..5 whose status goes out on word 6 */
extern volatile uint8_t  inject_tail;      /* 0x03DE : inject queue read index (& 0x1F) */
extern volatile uint16_t inject_queue[];   /* 0x01BD : 32 words */
extern volatile uint8_t  inject_repeat[];  /* 0x03E0 : 32 repeat counts */
extern volatile uint16_t prog_ticks[];     /* 0x0190 = prog_buf[0..11]: u16 tank capacity per car (cmd J) */
extern volatile slot16_t slot_tab[];       /* 0x021C + 16*i */

/* ---------- firmware functions ---------- */
extern int16_t adc_to_throttle_level(uint8_t ch);               /* 0x16F2 */
extern void    idle_timeout_service(void);                      /* 0x15B0 */
extern void    inject_queue_push(uint16_t, uint8_t, uint8_t);   /* 0x15F8 */
extern void    slot_word_compose(uint8_t, uint8_t);             /* 0x0754 */
extern void    state_machine_run(void);                         /* 0x1C76 */

void word_cycle_step(void)
{
    uint8_t id, k;

    k = cycle_idx;
    cycle_idx = (k < 10) ? cycle_next_table[k] : 0;
    id = cycle_idx;

    switch (id) {
    /* ---------- words 0..5: the six controllers ---------- */
    case 0: case 1: case 2: case 3: case 4: case 5: {
        int i = id;
        uint8_t c, sw, thr, edge;
        uint16_t t;

        /* 1. input: C command table, then the decoded byte (low nibble throttle,
         *    bit 4 = switch released), else the controller itself (ADC + PINB bit). */
        c = ctl_cmd_table[i];
        if (c != 0) {
            thr = c & 0x0F;
            sw = ((c >> 4) & 1) ^ 1;
        } else if (ctl_rx_table[i] != 0) {
            thr = ctl_rx_table[i] & 0x0F;
            sw = ((ctl_rx_table[i] >> 4) & 1) ^ 1;
        } else {
            uint8_t f;
            if (id < 2)
                goto arm_a;
            f = ctl_edge_flags;
            if (id < 4) {
                if (f != 0)
                    goto absent;
            arm_a:                              /* ids 0..3: ADC channel id, PINB bit id+4 */
                thr = adc_to_throttle_level(id);
                sw = (PINB >> (i + 4)) & 1;
                goto have;
            }
            if (f == 0)
                goto absent;
            thr = adc_to_throttle_level(id - 2); /* ids 4,5: channel id-2, PINB bit id+2 */
            sw = (PINB >> (i + 2)) & 1;
            goto have;
        absent:                                 /* the other bank is active: no controller */
            thr = 0;
            sw = 1;
        have:;
        }

        /* 2. any activity resets the idle timer; press_edge = switch down now, up before */
        if (sw == 0 || thr != 0) {
            idle_timeout_service();
            if (sw == 0 && slot_tab[i].sw != 0) {
                edge = 1;
                goto have_edge;
            }
        }
        __asm__ __volatile__("");               /* keeps this block alive (see header) */
        edge = 0;
    have_edge:
        slot_tab[i].press_edge = edge;
        ctl_rx_table[i] = 0;                    /* byte consumed */

        if (ctl_table_stamp != 0) {             /* cmd C table times out */
            ctl_table_stamp--;
            if (ctl_table_stamp == 0)
                memset(ctl_cmd_table, 0, 8);
        }

        /* 3. fuel logic (skipped while the alternate word pair is selected) */
        if (unk_217 == 0) {
            t = slot_tab[i].fuel;
            if (slot_tab[i].reply_flag == 1) {
                if (((car_arm_mask >> id) & 1) && thr == 0) {
                    car_arm_mask &= ~(1 << id);
                    slot_tab[i].reply_flag = 0;
                } else if (thr > 5) {
                    slot_tab[i].reply_acc += thr;
                }
                if (slot_tab[i].reply_acc >= 0x97 || thr > 12) {
                    slot_tab[i].reply_acc = 0;
                    slot_tab[i].reply_flag = 0;
                    inject_queue_push((i << 5) | 5, 0, 1);
                }
            }
            if ((btn_c6_held != 0 || btn_b0_held != 0) && ta_off_flag != 0) {
                /* fuel mode active: burn `thr` per cycle; empty tank = throttle limit 10 */
                unk_211 = 0;
                if (t >= thr)
                    t -= thr;
                else
                    t = 0;
                if (t == 0) {
                    if (thr > 10)
                        thr = 10;
                }
                if (slot_tab[i].reply_flag == 1) {
                    if (t == 0)
                        t = (prog_ticks[i] / 14) * 2 - 1;   /* reserve */
                    if (thr == 0) {
                        if (sw == 0) {          /* stopped, button down: refuel 150/cycle */
                            uint16_t pt = prog_ticks[i];
                            if (t < pt) {
                                t += 150;
                                if (t > pt) {   /* full */
                                    t = pt - 1;
                                    inject_queue_push((i << 5) | 5, 0, 1);
                                }
                            }
                        }
                        sw = 1;                 /* the button is hidden while stopped */
                    }
                }
                if (t != 0) {
                    /* tank level = t / (capacity/14) (+1), displayed as (level+1)/2 */
                    uint8_t lvl, ratio;
                    uint16_t q2 = t / (prog_ticks[i] / 14);
                    lvl = q2;
                    if (lvl < 14)
                        lvl = lvl + 1;
                    slot_tab[i].tank = lvl;
                    ratio = (uint8_t)(lvl + 1) >> 1;
                    if (ratio != (slot_tab[i].status & 7))
                        inject_queue_push((i << 5) | 0x0A, ratio, 1);
                    slot_tab[i].status = ratio;
                } else {                        /* empty */
                    slot_tab[i].tank = 0;
                    if ((slot_tab[i].status & 7) != 0)
                        inject_queue_push((i << 5) | 0x0A, 0, 1);
                    slot_tab[i].status = 8;
                }
            } else {
                /* fuel mode off: announce once (level 0x0F), full tank */
                if (unk_211 == 0) {
                    unk_211 = 1;
                    inject_queue_push((i << 5) | 0x0A, 0x0F, 1);
                }
                slot_tab[i].status = 0;
                t = prog_ticks[i] - 1;
            }
            slot_tab[i].fuel = t;
            if ((car_arm_mask >> id) & 1) {     /* armed car: throttle limit 10, flag bit 3 */
                if (thr > 10)
                    thr = 10;
                slot_tab[i].status |= 8;
            }
        }
        slot_tab[i].sw = sw;
        slot_tab[i].throttle = thr;
        slot_word_compose(id, unk_217);
        break;
    }

    /* ---------- word 7: blink flag of slot 7, then the state machine ---------- */
    case 7: {
        uint8_t v = slot_tab[7].throttle;
        if (v & 8)
            v = 0;
        else
            v = 8;
        if (sm_state != 0x17)
            v |= 4;
        else
            v |= 7;
        slot_tab[7].throttle = v;
        slot_word_compose(7, unk_217);
        state_machine_run();
        break;
    }

    /* ---------- word 6: pace/programming word (slot 6, 12 bits) ---------- */
    case 6: {
        uint8_t tail = inject_tail;
        if (inject_repeat[tail] != 0) {         /* queued word: send it `repeat` times */
            slot_tab[6].word = inject_queue[tail];
            inject_repeat[tail]--;
            if (inject_repeat[tail] == 0)
                inject_tail = (tail + 1) & 0x1F;
        } else {                                /* idle: status nibble of slot pace_idx */
            uint8_t n = pace_idx;
            uint8_t b = slot_tab[n].status;
            if (ta_off_flag != 0 && btn_b0_held != 0)
                b &= 0x0F;
            else
                b &= 0x08;
            slot_tab[6].word = ((uint16_t)n << 9) | 0x40 | b;
            n = n + 1;
            if (n == 6)
                pace_idx = 0;
            else
                pace_idx = n;
        }
        break;
    }

    /* ---------- words 8, 9: 7-bit words (word 9 may carry reply_seen_mask) ---------- */
    case 8: case 9:
        if (reply_seen_mask != 0 && id == 9) {
            slot_tab[9].word = reply_seen_mask;
            slot_tab[9].period = 0x1A2C;
            slot_tab[9].bit_count = 8;
            reply_seen_mask = 0;
        } else {
            uint8_t cnt = 0, acc = 0, w;
            int n;
            for (n = 5; n >= 0; n--) {          /* bit n = slot n has a non-zero throttle */
                uint8_t b = (slot_tab[n].throttle != 0);
                acc = (acc << 1) | b;
                cnt += b;
            }
            w = (cnt << 6) | acc;
            slot_tab[id].word = w;
            slot_tab[id].period = 0x1A90;
            slot_tab[id].bit_count = 7;
        }
        break;
    }
}

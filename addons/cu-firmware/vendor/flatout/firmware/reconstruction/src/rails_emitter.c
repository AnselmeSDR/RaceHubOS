/* recon_D.c — reconstruction of FUN_code_075c @ flash 0x0EB8 (980 bytes)
 * Carrera Digital V339 — ATmega16 — avr-gcc 5.4.0+Atmel3.6.0 -Os -mmcu=atmega16
 * ==========================================================================
 * MATCHED: 980/980 at the pin and at link (see rail_events_process). Historical note (at 251/980; residual =
 *   GCC register allocation: the target recomputes the car address
 *   (mul 0x23 at each segment) and keeps idx/last_chan in Y (r29/r28), whereas
 *   here GCC keeps the address in r12:r13 and idx/last_chan in r14/r15.
 *   NB: the SAME source compiled with 4.9.2 (gcc49) gives the EXACT target
 *   prologue (push sum_bytes_v0-r11,r14-r17,r28,r29, no frame) and 50 identical
 *   bytes at the start — lead to investigate (cf. report).
 * ==========================================================================
 * SEMANTICS: "rails" task (called rail_events_process(); timer2_tick_poll(); at the end of the main
 * loop, ~once per cycle). 3-phase state machine on rails_phase (0x006D):
 *
 *   phase 0: ONE car per call (round-robin rails_rr_idx++ & 7). Processes the car's
 *     armed_chan rail event (car->armed_chan, set by 0x0C6E from global timer 0x1B0
 *     when a rail pulse is seen):
 *       - exits if armed_chan==0, or address excluded (mask exclusion_mask = cmd ':'),
 *         or (slot[idx].v != 0 && car_arm_mask bit clear) && !(PINB.1);
 *       - a = car->time (timestamp); last_chan goes 0-based (last_chan--);
 *       - prog_mode_param (0x00E8, cmd J word 0xF5) != 0: simple log;
 *       - if seen == 0: 1st event of the car — on channel 1:
 *           prev_time = a; seen = 1; screen telegrams (4,6)(0,0xF);
 *           phase = 1;
 *       - else d = a - car->last_time; if 0x1F5 <= d < 0xFFFF0000:
 *           channel 1: e = a - prev_time; car->lap_counter++; prev_time = a;
 *                     bu = (e < best); if bu best = e;
 *                     if (d < min_gap[0] && car->last_chan != 0): min_gap[0] = d,
 *                       then if bu: telegram (4,0x1E)(0,0xF) + word (idx<<5)|8
 *                       else      : telegram (4,6)(0,6)(4,6)(0,0xF)
 *                     else if bu: telegram (4,0x1E)(0,0xF) + word (idx<<5)|8
 *                     else        : telegram (4,6)(0,0xF) + word (idx<<5)|9
 *           other channel: either last_chan == car->last_chan (nothing), or
 *                     min_gap[last_chan] = min(min_gap[last_chan], d) + telegram (4,6)(0,6)(4,6)(0,F);
 *           → phase = 1;
 *       - common tail (all paths reached): car->last_time = a;
 *         car->last_chan = last_chan; write one 6-byte ring record
 *         {idx, a(32b), last_chan} via event_ring_wr (0x00DB), wrap 0x0113 → 0x00E9;
 *       - then car->armed_chan = 0 (including jump paths).
 *
 *   phase 1: ranking: rank_mode ? rank_compute_b(n) : rank_compute_a(n); phase = 2.
 *     (rank_compute_a/rank_compute_b = car ranking by counter lap_counter[+0] and timestamps;
 *      write car->laps (+0x20) for seen cars.)
 *
 *   phase 2: for each car i < cfg_car_count:
 *       if laps != pos_sent && seen: inject_queue_push((i<<5)|6, laps, 1) then
 *       pos_sent = laps   (positions to the tower display);
 *     then if frame_quote_flag == 0 (no '"' frame in progress): search for the
 *     leader car (laps == 1); if PINB.1 is CLEAR (sbic) and lap_counter != leader_laps_sent:
 *       leader_laps_sent = lap_counter (volatile); if lap_counter <= 0xFF:
 *         inject_queue_push(0xF1, lap_counter>>4, 1); inject_queue_push(0xF2, lap_counter, 1);
 *     phase = 0.
 *
 * Structures: car_t @0x02BE (8 × 35 bytes), race slot @0x021C (16 bytes, v
 * 16-bit at +9 set by cmd J), event ring @0x00E9 (8 × 6 bytes).
 * All global accesses = external symbols (addresses resolved at link).
 */
#include <stdint.h>
#include <avr/io.h>

/* ---- symbolic globals ---- */
extern uint8_t rails_phase;              /* 0x006D : rails task state (0/1/2) */
extern uint8_t rails_rr_idx;              /* 0x006C : round-robin counter */
extern uint8_t prog_mode_param;            /* 0x00E8 : programming mode (cmd J word 0xF5) */
extern uint8_t *event_ring_wr;           /* 0x00DB : ring write pointer */
extern uint8_t frame_quote_flag;           /* 0x011C : '"' flag (update/scan in progress) */
extern uint8_t cfg_car_count;              /* 0x01A0 : number of active cars */
extern uint8_t rank_mode;           /* 0x01B6 : mode (cmd '=' bit 1) */
extern uint8_t car_arm_mask;            /* 0x01B7 : per-address enable mask */
extern volatile uint16_t leader_laps_sent; /* 0x01A4 : last_time leader counter sent */
extern uint8_t exclusion_mask;           /* 0x0212 : exclusion mask (cmd ':') */

void beep_queue_push(uint8_t a, uint8_t v);  /* 0x0140 : screen telegram queue */
void inject_queue_push(uint8_t w, uint8_t v, uint8_t r); /* 0x15F8 : rail word queue */
void rank_compute_a(uint8_t n);             /* 0x12AE : ranking (race mode) */
void rank_compute_b(uint8_t n);             /* 0x1344 : ranking (alternate mode) */

/* race slot @0x021C (16 bytes), 16-bit value at +9 (set by cmd J) */
typedef struct { uint8_t b[9]; uint16_t v; uint8_t r[5]; } slot_t;
#define SLOTS ((slot_t *)0x021C)

/* car @0x02BE, stride 35 bytes */
typedef struct {
    uint16_t lap_counter;      /* +0x00 : lap counter, channel 1 */
    uint32_t time;     /* +0x02 : last_time timestamp (set by 0x0C6E) */
    uint32_t last_time;     /* +0x06 : timestamp of last_time processed event */
    uint32_t best;     /* +0x0A : best time (channel 1) */
    uint32_t prev_time;     /* +0x0E : previous timestamp (channel 1) */
    uint32_t min_gap[3];  /* +0x12 : minima per channel (channel-1) */
    uint8_t  armed_chan;    /* +0x1E : channel armed_chan by 0x0C6E (0 = none) */
    uint8_t  last_chan;     /* +0x1F : last_time channel-1 processed */
    uint8_t  laps;      /* +0x20 : current position (ranking) */
    uint8_t  rank_sent;  /* +0x21 : last_time position sent */
    uint8_t  seen;   /* +0x22 : car already seen (channel 1) */
} car_t;               /* 35 bytes */
#define CARS ((car_t *)0x02BE)

/* rail_events_process @0x0EB8 (980 B): 980/980 MATCH at the pin (5.4.0+Atmel3.6.0 -Os), both score.py
 * and linkcheck.py (the link check includes the branch encodings that score.py masks; it was 843/980
 * with the old layout). Globals are block-scope externs (relocated, not folded). Layout that matches:
 *   - no materialised gap flag: the gap test branches on bu directly; `__builtin_expect(bu, 0)` selects
 *     the and/breq polarity of the original (with expect 1, or none, GCC emits cpse + rjmp: 975/980);
 *   - the non-gap test is `bu == 1` (cpi/breq); the C arm (beep 4,6 / beep 0,F / word |9) follows it,
 *     then the bu arm (beep 4,0x1E / beep 0,F / word |8), then the four-beep block last, falling into
 *     the shared `rails_phase = 1` tail;
 *   - `(int)(j << 5)`: the 16-bit shift loop of the original (the plain form narrows to swap/andi here);
 *   - no empty asm pin on j: once the layout matches, the registers match without it. */
void rail_events_process(void)
{
    extern car_t car_tab[];     /* 0x02BE, relocated (method.md: symbolic externs) */
    extern slot_t slot_tab[];   /* 0x021C */
    extern uint8_t event_ring[];  /* 0x00E9 : 8 entries x 6 bytes */
    switch (rails_phase) {
    case 0: {
        uint8_t cur = rails_rr_idx;
        uint8_t idx = cur & 7;
        rails_rr_idx = cur + 1;
        uint16_t j = idx;
        uint8_t last_chan = car_tab[idx].armed_chan;
        if (last_chan != 0 && !((exclusion_mask >> idx) & 1) &&
            ((slot_tab[j].v != 0 && !((car_arm_mask >> idx) & 1)) || (PINB & 2))) {
            last_chan--;
            uint32_t a = car_tab[j].time;
            if (prog_mode_param == 0) {
                if (car_tab[j].seen != 0) {
                    uint32_t d = a - car_tab[j].last_time;
                    if (d >= 0x1F5 && d < 0xFFFF0000) {
                        if (last_chan != 0) {
                            if (last_chan != car_tab[j].last_chan) {
                                uint32_t *mg = &car_tab[j].min_gap[last_chan];
                                if (d < *mg) {
                                    beep_queue_push(4, 6);
                                    beep_queue_push(0, 6);
                                    beep_queue_push(4, 6);
                                    beep_queue_push(0, 0x0F);
                                    *mg = d;
                                }
                            }
                        } else {
                            uint32_t e = a - car_tab[j].prev_time;
                            uint8_t bu;
                            car_tab[j].lap_counter++;
                            car_tab[j].prev_time = a;
                            if (e < car_tab[j].best) {
                                car_tab[j].best = e;
                                bu = 1;
                            } else {
                                bu = 0;
                            }
                            if (d < car_tab[j].min_gap[0] && car_tab[j].last_chan != 0) {
                                car_tab[j].min_gap[0] = d;
                                if (__builtin_expect(bu, 0))
                                    goto bu_arm;
                                goto four_beep;
                            }
                            if (bu == 1)
                                goto bu_arm;
                            beep_queue_push(4, 6);
                            beep_queue_push(0, 0x0F);
                            inject_queue_push((int)(j << 5) | 9, 1, 1);
                            goto phase_one;
                        bu_arm:
                            beep_queue_push(4, 0x1E);
                            beep_queue_push(0, 0x0F);
                            inject_queue_push((int)(j << 5) | 8, 1, 1);
                            goto phase_one;
                        four_beep:
                            beep_queue_push(4, 6);
                            beep_queue_push(0, 6);
                            beep_queue_push(4, 6);
                            beep_queue_push(0, 0x0F);
                        }
                        phase_one: rails_phase = 1;
                    }
                } else {
                    if (last_chan == 0) {
                        car_tab[j].prev_time = a;
                        car_tab[j].seen = 1;
                        beep_queue_push(4, 6);
                        beep_queue_push(0, 0x0F);
                        rails_phase = 1;
                    }
                }
            }
            car_tab[j].last_time = a;
            car_tab[j].last_chan = last_chan;
            uint8_t *p = event_ring_wr;
            p[0] = idx;
            *(uint32_t *)(p + 1) = a;
            p[5] = last_chan;
            if (p == &event_ring[42])
                event_ring_wr = event_ring;
            else
                event_ring_wr = p + 6;
        }
        car_tab[j].armed_chan = 0;
        break;
    }

    case 1:
        if (rank_mode)
            rank_compute_b(cfg_car_count);
        else
            rank_compute_a(cfg_car_count);
        rails_phase = 2;
        break;

    case 2: {
        uint8_t i;
        for (i = 0; i < cfg_car_count; i++) {
            if (car_tab[i].laps != car_tab[i].rank_sent && car_tab[i].seen != 0) {
                inject_queue_push((i << 5) | 6, car_tab[i].laps, 1);
                car_tab[i].rank_sent = car_tab[i].laps;
            }
        }
        if (frame_quote_flag == 0) {
            uint8_t k = frame_quote_flag;
            while (car_tab[k].laps != 1)
                k++;
            if (!(PINB & 2) && leader_laps_sent != car_tab[k].lap_counter) {
                leader_laps_sent = car_tab[k].lap_counter;
                if (leader_laps_sent <= 0xFF) {
                    inject_queue_push(0xF1, leader_laps_sent >> 4, 1);
                    inject_queue_push(0xF2, leader_laps_sent, 1);
                }
            }
        }
        rails_phase = 0;
        break;
    }
    }
}

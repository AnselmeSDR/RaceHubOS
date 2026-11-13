/* recon_B.c — BATCH B: main loop (zone 0x2F8A-0x351E) of firmware V339
 * (Carrera Digital 124, ATmega16).
 *
 * PINNED toolchain: avr-gcc 5.4.0+Atmel3.6.0 (gcc54 container), -Os -mmcu=atmega16.
 * Symbolic method (externs resolved at link; cf. method.md).
 *
 * Targets:
 *   rail_cycle_service  @0x2F8A (272 bytes) — state machine/race     ✅ byte-exact (score+link)
 *   rail_tx_shift_isr @0x309A (172 bytes) — ISR(TIMER1_COMPB)      ✅ byte-exact (score+link)
 *   slots_init  @0x3146 (178 bytes) — init slots 0..9 + compositor ✅ byte-exact (score+link)
 *   rail_tx_init  @0x31F8 ( 82 bytes) — init Timer1            ✅ byte-exact (score+link)
 *   rail_reply_rx_step  @0x324A (724 bytes) — loop on var_1FD        ✅ byte-exact (score+link)
 *        the final store reads m (p[30] = m & 3): acc dies early, so the register
 *        assignment of acc/slot/m matches (acc→r14:r15, slot→r16:r17, m→r28:r29).
 *
 * C forms validated at pin (specific to 5.4.0+Atmel3.6.0):
 *   - rail_cycle_service : switch(cycle_idx) { case 0/1/2/7 → timers_update(); case 3 → ...; } (GCC
 *     decision tree, single lds) ; if(y != 0) POSITIVE ; cycle table via
 *     local `i` (single lds in Zlo) ; slots = (0x21C+(v<<4)) × 3 (mul idiom).
 *   - rail_tx_shift_isr : `uint8_t c = tx_bits_left;` + `tx_bits_left = c - 1;` (otherwise reload) ;
 *     `OCR1B = OCR1A - 50;` (avr_out_plus output: subi+sbc if pair is non-ADIW) ;
 *     32-bit copy tx_clock_snap = tick_clock32 (4 lds then 4 sts, batched).
 *   - slots_init : `uint8_t i = (uint8_t)y;` (cpi r28,6 without cpc) ; `for(...; y++, tp++)`
 *     (adiw order before tp++) ; pointer = symbol prog_buf (ldi+mov r12/r13).
 *   - rail_tx_init : TIFR=8 / TIMSK|=8 (NOT RAMPD/RAMPX — that is m16).
 *   - rail_reply_rx_step : switch(reply_phase) WITH explicit cases 2..15 (tree = target) ;
 *     windows (y<<8)+0x940 / +0x972 ; reply_seen_mask |= 1<<pos (no cast: keeps
 *     the 16-bit shift tied to the CSE of "1" with ~(1<<reply_addr)).
 */
#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>

#define ISR_NAMED(nom) \
    void nom(void) __attribute__((signal, used, externally_visible)); \
    void nom(void)

/* ---------- SRAM globals (addresses set by linker) ---------- */
extern volatile uint8_t op_mode;   /* 0x0210 : state (2 = standby) */
extern volatile uint8_t cycle_idx;   /* 0x01BA : race state */
extern uint8_t cfg_keep_awake;            /* 0x01A1 */
extern volatile uint16_t idle_timeout;  /* 0x02BC : 16-bit stopwatch */
extern volatile uint8_t reply_phase;   /* 0x01FD : phase (0..0x10) */
extern volatile uint8_t reply_addr;   /* 0x03DD : active position */
extern uint16_t tx_shift_reg;           /* 0x03D6 : PWM B counter (16 bits) */
extern uint8_t tx_bits_left;            /* 0x03DF : countdown COMPB */
extern uint16_t tx_period;           /* 0x021A : OCR1A value (scale) */

extern uint16_t reply_bits;           /* 0x0215 : message bits (16 bits) */
extern uint8_t unk_1bc;            /* 0x01BC */
extern uint8_t start_window_ticks;            /* 0x01B8 */
extern uint8_t car_arm_mask;            /* 0x01B7 : rail mask */
extern uint8_t btn_c6_held;            /* 0x01B5 */
extern uint8_t btn_b0_held;            /* 0x01B4 */
extern uint8_t ta_off_flag;            /* 0x020F */
extern uint8_t unk_20e;            /* 0x020E */
extern uint8_t frame_quote_flag;            /* 0x011C */
extern uint8_t reply_seen_mask;            /* 0x0401 */
extern uint8_t sm_state;          /* 0x0218 : main state machine state */
extern uint32_t tick_clock32;           /* 0x01B0..0x01B3 : cycle clock */
extern uint32_t tx_clock_snap;           /* 0x0412..0x0415 : clock copy */
extern uint16_t slot6_period;           /* 0x0283 (hi @0x0284) */
extern uint8_t slot6_bit_count;            /* 0x0282 */
extern uint16_t slot8_period;           /* 0x02A3 */
extern uint8_t slot8_bit_count;            /* 0x02A2 */
extern uint16_t slot9_period;           /* 0x02B3 */
extern uint8_t slot9_bit_count;            /* 0x02B2 */

/* ---------- firmware externs ---------- */
extern unsigned char prog_buf[];   /* 0x0190 : PROG frame buffer (EEPROM) */
extern void update_stream_step(void);          /* 0x1A5C */
extern void adc_sample_channels(uint8_t);       /* 0x162C */
extern void ctl_window_start(void);           /* 0x0B02 */
extern void power_down_or_blink(void);          /* 0x155C */
extern void timers_update(void);          /* 0x1728 */
extern void word_cycle_step(void);          /* 0x2A4E */
extern void slot_word_compose(uint8_t, uint8_t);        /* 0x0754 : compositor */
extern uint8_t rail_reply_bit_read(void);       /* 0x1524 */
extern void inject_queue_push(uint16_t, uint8_t, uint8_t); /* 0x15F8 */
extern void beep_queue_push(uint8_t, uint8_t); /* 0x0140 */

/* ==================== rail_cycle_service @ 0x2F8A (272 bytes) ==================== */
void rail_cycle_service(void)
{
    uint8_t t;
    uint8_t i;

    if (op_mode == 2) {
        update_stream_step();
        adc_sample_channels(0);
    } else {
        switch (cycle_idx) {
        case 0: case 1: case 2:
        case 7:
            timers_update();
            break;
        case 3:
            ctl_window_start();
            if (cfg_keep_awake == 0) {
                uint16_t y = idle_timeout;
                if (y != 0) {
                    y--;
                } else {
                    power_down_or_blink();
                }
                idle_timeout = y;
            }
            timers_update();
            break;
        }

        if (cycle_idx < 6 || cycle_idx > 7) {
            if (TCCR1A & 0x20) {
                reply_phase = 1;
                reply_addr = cycle_idx;
                if (cycle_idx > 7)
                    reply_addr -= 2;
            }
        }

        word_cycle_step();

        i = cycle_idx;
        if (i < 10) {
            t = *(uint8_t *)(0x62 + i);
            if (t >= 4)
                t -= 2;
        } else {
            t = 0;
        }
        adc_sample_channels(t);

        {
            uint8_t *st = (uint8_t *)(0x21C + ((uint16_t)cycle_idx << 4));
            tx_shift_reg = *(uint16_t *)(st + 14);
        }
        {
            uint8_t *st = (uint8_t *)(0x21C + ((uint16_t)cycle_idx << 4));
            tx_bits_left = st[6];
        }
        {
            uint8_t *st = (uint8_t *)(0x21C + ((uint16_t)cycle_idx << 4));
            tx_period = *(uint16_t *)(st + 7);
        }
    }

    OCR1A = 100;
    OCR1B = 0x32;
}

/* ==================== rail_tx_shift_isr @ 0x309A (172 bytes) — TIMER1 COMPB ============ */
ISR_NAMED(rail_tx_shift_isr)
{
    uint8_t c = tx_bits_left;

    if (c == 0) {
        if (TCCR1A & 0x20)
            TCCR1A = 0x23;
        OCR1A = tx_period;
        OCR1B = OCR1A - 50;
        tx_clock_snap = tick_clock32;
    } else {
        uint16_t v = tx_shift_reg;
        if (TCCR1A & 0x20) {
            if (v & 1)
                TCCR1A = 0x23;
            else
                TCCR1A = 0x33;
        }
        tx_shift_reg = v >> 1;
    }
    tx_bits_left = c - 1;
}

/* ==================== slots_init @ 0x3146 (178 bytes) ==================== */
void slots_init(void)
{
    uint16_t y;
    uint16_t *tp = (uint16_t *)prog_buf;

    for (y = 0; y < 10; y++, tp++) {
        uint8_t i = (uint8_t)y;
        uint8_t *st = (uint8_t *)(0x21C + (y << 4));
        *(uint16_t *)(st + 7) = 6600;      /* 0x19C8 */
        st[5] = 1;
        st[4] = 0;
        if (i < 6)
            *(uint16_t *)(st + 9) = *tp;
        else
            *(uint16_t *)(st + 9) = 0xFFFF;
        slot_word_compose(i, 0);
    }

    slot6_period = 0x189C;
    slot6_bit_count = 0x0C;
    slot8_period = 0x1A90;
    slot8_bit_count = 7;
    slot9_period = 0x1A90;
    slot9_bit_count = 7;
}

/* ==================== rail_tx_init @ 0x31F8 (82 bytes) ==================== */
void rail_tx_init(void)
{
    uint8_t *st;

    slots_init();
    st = (uint8_t *)0x21C;
    tx_shift_reg = *(uint16_t *)(st + 14);
    tx_bits_left = st[6];

    TCCR1A |= 0x20;
    TCCR1A |= 3;
    TCCR1B |= 0x18;
    TIFR = 8;
    TIMSK |= 8;
    OCR1A = 100;
    OCR1B = 0x32;
    TCNT1H = 0;
    TCNT1L = 0;
    TCCR1B |= 2;
}

/* ==================== rail_reply_rx_step @ 0x324A (724 bytes) ==================== */
/* Matches 724/724 bytes (score + link). The last store reads m instead of acc (m & 3 is
 * acc & 3 under the 0xDFFF mask): acc then dies early, which gives the target register
 * assignment of the three 16-bit values live across the calls (acc=r14:r15, slot=r16:r17,
 * m=r28:r29). Before this, the build had 671/724 (acc=r28:r29, slot=r14:r15, m=r16:r17).
 *
 * Volatile views: the target keeps these RAM accesses in source order (no sinking of
 * the loads past the shift loops). They are local macros, so the file-level externs
 * (and the other functions of this file) are left unchanged. */
#define V_REPLY_BITS (*(volatile uint16_t *)&reply_bits)
#define V_SEEN       (*(volatile uint8_t *)&reply_seen_mask)
#define V_CAR_ARM    (*(volatile uint8_t *)&car_arm_mask)
#define V_UNK_20E    (*(volatile uint8_t *)&unk_20e)
#define V_TX_SNAP    (*(volatile uint32_t *)&tx_clock_snap)

void rail_reply_rx_step(void)
{
    switch (reply_phase) {
    case 1:
        if (TCNT1 >= 0x941) {
            ADMUX = 7;
            V_REPLY_BITS = 0;
            if (rail_reply_bit_read() != 0) {
                reply_phase = 2;
                return;
            }
            reply_phase = 0;
        }
        return;

    case 2: case 3: case 4: case 5: case 6: case 7: case 8:
    case 9: case 10: case 11: case 12: case 13: case 14: case 15: {
        uint8_t p = reply_phase;
        uint16_t t = TCNT1;
        uint16_t y = (uint8_t)(p - 1);
        if (t > (uint16_t)((y << 8) + 0x940)) {
            t = TCNT1;
            if (t > (uint16_t)((y << 8) + 0x972)) {
                reply_phase = 0;
                return;
            }
            if ((unk_1bc != 0 || reply_phase == 15 || reply_phase < 7) && rail_reply_bit_read() != 0)
                V_REPLY_BITS |= (uint16_t)1 << (y - 1);
            reply_phase++;
            if (reply_phase == 7 && (V_REPLY_BITS & 0x1F) == 0) {
                reply_phase = 0;
                return;
            }
        }
        return;
    }

    case 0x10: {
        uint8_t pos;
        uint16_t acc;
        uint16_t slot;
        uint16_t m;

        reply_phase = 0;

        pos = reply_addr;
        acc = V_REPLY_BITS;
        if ((acc & 0x2000) == 0)
            return;
        slot = pos;
        __asm__ volatile("" : "+r"(slot));
        V_SEEN |= 1 << pos;

        if (start_window_ticks != 0) {
            if (reply_addr != 0)
                return;
            if (acc & 1)
                ta_off_flag = 1;
            if (acc & 2)
                unk_1bc = 1;
            return;
        }

        if (sm_state == 2) {
            if ((acc & 0x1F) != 10)
                return;
            beep_queue_push(4, 6);
            return;
        }

        m = acc & 0xDFFF;
        __asm__ volatile("" : "+r"(m));

        switch ((m >> 2) & 7) {
        case 1: {
            uint8_t *st = (uint8_t *)(0x21C + (slot << 4));
            st[12] = 1;
            if ((btn_c6_held != 0 || btn_b0_held != 0) && ((V_CAR_ARM >> reply_addr) & 1) == 0)
                inject_queue_push((uint16_t)((slot << 5) | 5), 1, 1);
            break;
        }
        case 2:
            V_UNK_20E &= ~(1 << reply_addr);
            break;
        case 3: {
            uint8_t *st = (uint8_t *)(0x21C + ((uint16_t)reply_addr << 4));
            if (st[0] >= 11)
                V_CAR_ARM |= 1 << reply_addr;
            V_UNK_20E |= 1 << reply_addr;
            break;
        }
        case 4:
            V_CAR_ARM |= 1 << reply_addr;
            break;
        default:
            break;
        }

        if ((acc & 3) != 0) {
            if ((PINB & 2) == 0 || frame_quote_flag != 0) {
                uint32_t x = V_TX_SNAP;
                uint8_t *p = (uint8_t *)(0x2BE + slot * 0x23);
                *(uint32_t *)(p + 2) = x - (uint16_t)(m >> 5);
                p[30] = m & 3;
            }
        }
        return;
    }
    }
}

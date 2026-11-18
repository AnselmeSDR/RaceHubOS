/* recon_A.c — batch zone 0x1524-0x1A5C (10 functions), ATmega16, -Os
 * Agent A. Symbolic method (externs) + literals where the target is folded.
 * Pin: avr-gcc 5.4.0+Atmel3.6.0 (container gcc54), -Os -mmcu=atmega16.
 */
#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

/* ---- globals (addresses resolved at link time) ---- */
extern volatile uint8_t adc_fault_flag;   /* 0x03DB */
extern volatile uint16_t stream_checksum_prev;    /* 0x03D9 */
extern volatile uint8_t b_1b9;     /* 0x01B9 */
extern volatile uint16_t delay_ticks;     /* 0x0092 */
extern uint16_t beep_ticks_left;              /* 0x00D7 (non-volatile) */
extern volatile uint8_t beep_q_rd;      /* 0x00D4 */
extern volatile uint8_t beep_q_wr;      /* 0x00D5 */
extern volatile uint8_t start_window_ticks;     /* 0x01B8 */
extern volatile uint16_t pd5_pulse_ticks;     /* 0x0090 */
extern volatile uint8_t lights_pattern;     /* 0x0416 */
extern volatile uint8_t b_217;     /* 0x0217 */
extern volatile uint8_t cfg_keep_awake;      /* 0x01A1 */
extern uint16_t unk_w75;              /* 0x0075 (non-volatile) */
extern uint8_t unk_b74;               /* 0x0074 (non-volatile) */
extern uint8_t unk_b77;               /* 0x0077 (non-volatile) */
extern uint8_t unk_b78;               /* 0x0078 (non-volatile) */
extern uint16_t unk_w79;              /* 0x0079 (non-volatile) */
extern volatile uint8_t cmd_e_pending;      /* 0x00DA */
extern volatile uint8_t cmd_g_param;      /* 0x00E7 */
extern volatile uint8_t inject_head;     /* 0x01BB */
extern volatile uint8_t b_1fe;     /* 0x01FE */
extern volatile uint8_t stream_key;     /* 0x01FF */
extern volatile uint8_t stream_checksum;     /* 0x03D8 */
extern volatile uint16_t tx_shift_reg;    /* 0x03D6 */
extern volatile uint8_t tx_bits_left;     /* 0x03DF */
extern volatile uint8_t st_8c;     /* 0x008C */
extern volatile uint8_t timers_div4;    /* 0x008D */
extern volatile uint8_t sm_state; /* 0x0218 */
extern volatile uint16_t w_40e;    /* 0x040E (adc ch6) */
extern volatile uint16_t w_410;    /* 0x0410 (adc ch7) */
extern volatile uint16_t fnptr;    /* 0x008E */

/* firmware externals (resolved at link time) */
extern uint8_t serial_buf[];  /* 0x011D */
void buzzer_set_mode(uint8_t m);   /* 0x0122 */
void beep_queue_push(uint8_t a, uint8_t b); /* 0x0140 */

/* ================== 0x1524 : ADC autotune (returns bit7) ================== */
uint8_t rail_reply_bit_read(void)
{
    uint16_t n = 9;
    uint8_t v = 0x7F;
    TCCR1A &= 0xCF;
    do {
        ADCSRA = 0xD1;
        while (!(ADCSRA & 0x10))
            ;
        if (ADC >= 0x33)
            v++;
        else
            v--;
    } while (--n);
    TCCR1A |= 0x20;
    return v >> 7;
}

/* ================== 0x155C : shutdown / sleep ================== */
void power_down_or_blink(void)
{
    if (adc_fault_flag == 0) {
        cli();
        PORTA = 0;
        PORTB = 0;
        PORTC = 0;
        PORTD = 0;
        TCCR0 = 0;
        TCCR1A = 0;
        TCCR1B = 0;
        TCCR2 = 0;
        *(volatile uint8_t *)0x5B = 0;
        UCSRA = 0;
        UCSRB = 0;
        UBRRH = 0;
        ADCSRA = 0;
        MCUCR = 0x60;
        *(volatile uint8_t *)0x59 = 0;
        *(volatile uint8_t *)0x58 = 0xFF;
        *(volatile uint8_t *)0x5A = 0xFF;
        sei();
        sleep_cpu();
        PORTA |= 0x10;
        for (;;)
            ;
    } else {
        uint8_t v;
        if (b_1b9 == 0) {
            PORTC |= 0x80;
            v = 0x34;
        } else {
            PORTC &= (uint8_t)~0x80;
            v = b_1b9 - 1;
        }
        b_1b9 = v;
    }
}

/* ================== 0x15B0 : idle watchdog: wait for released buttons ===== */
extern volatile uint16_t idle_timeout;  /* 0x02BC */
uint8_t buttons_scan(void);             /* 0x144C */

void idle_timeout_service(void)
{
    if (adc_fault_flag != 0 && idle_timeout == 0) {
        uint8_t n = 0;
        do {
            if (buttons_scan())
                n = 0xFF;
        } while (n--);
        ((void (*)(void))fnptr)();
    }
    idle_timeout = 0x3CF0;
}

/* ================== 0x15F8 : joystick word queue (a,b,c) ================== */
void inject_queue_push(uint8_t a, uint8_t b, uint8_t c)
{
    uint8_t i = inject_head;
    inject_head = (i + 1) & 0x1F;
    uint16_t idx = i;
    uint16_t v = (uint16_t)((a << 4) | (b & 0x0F));
    *(volatile uint16_t *)(0x01BD + (idx << 1)) = v;
    *(volatile uint8_t *)(0x03E0 + idx) = c;
}

/* ================== 0x162C : read 3 ADC channels ==================
 * MATCHED at the pin (scorer 198/198 + link 198/198). The index is doubled as `i + i`
 * (`0x0402 + i + i`): the zero-extend of i (`ldi r31,0`) then has TWO uses, so TER cannot
 * sink it to the store and it stays before the ADC reads (`in r30,ADMUX; andi; ldi r31,0;
 * in r24/r25,ADC; add r30,r30; adc r31,r31; subi/sbci 0x402`). The array form
 * `((uint16_t *)0x0402)[i]` (and i*2, i<<1, uint16_t/int i...) folds into a widening
 * multiply (_11 w* 2) whose zero-extend is emitted at the store, after the ADC reads (183/198). */
#define ADC_READ(mux)                                   \
    do {                                                \
        uint8_t i;                                      \
        ADMUX = (mux);                                  \
        ADCSRA = 0xD4;                                  \
        while (!(ADCSRA & 0x10))                        \
            ;                                           \
        i = (uint8_t)(ADMUX & 7);                       \
        *(uint16_t *)(0x0402 + i + i) = ADC;            \
    } while (0)

void adc_sample_channels(uint8_t mux)
{
    ADC_READ(mux);
    ADC_READ(6);
    ADC_READ(7);
    if (TCCR1A & 0x20) {
        uint16_t a = w_40e;
        if (a > (uint16_t)(w_410 + 0x46) || w_410 < 100) {
            adc_fault_flag = 1;
            stream_checksum_prev = 1;
            lights_pattern = 0x20;
            sm_state = 4;
        }
    }
    if (adc_fault_flag != 0)
        TCCR1A &= 0xCF;
    else
        TCCR1A |= 0x20;
}

/* ================== 0x16F2 : read voltage of channel idx, /16 ================== */
int16_t adc_to_throttle_level(uint8_t idx)
{
    int16_t v = *(uint16_t *)(0x0402 + ((uint16_t)idx << 1));
    if ((uint16_t)v < 0x1F)
        v = 0;
    else {
        v -= 0x1E;
        if ((uint16_t)v > 0xFF)
            v = 0xFF;
    }
    v >>= 4;
    return v;
}

/* ================== 0x1728 : timer tick / melody / LEDs ================== */
void timers_update(void)
{
    uint8_t i;
    if (delay_ticks != 0)
        delay_ticks--;
    if (beep_ticks_left != 0) {
        beep_ticks_left--;
    } else {
        i = beep_q_rd;
        if (i != beep_q_wr) {
            const uint8_t *p = (const uint8_t *)(0x94 + (((uint16_t)i & 0x1F) << 1));
            buzzer_set_mode(p[0]);
            beep_ticks_left = p[1] * 10 / 15;
            beep_q_rd = i + 1;
        } else {
            buzzer_set_mode(0);
        }
    }
    if (start_window_ticks != 0)
        start_window_ticks--;
    if (pd5_pulse_ticks != 0) {
        pd5_pulse_ticks--;
        if (pd5_pulse_ticks == 0)
            PORTD &= (uint8_t)~0x20;
    }
    if (stream_checksum_prev != 0) {
        stream_checksum_prev--;
        if (stream_checksum_prev == 0) {
            stream_checksum_prev = 0x10;
            lights_pattern--;
            if (lights_pattern == 0) {
                b_217 = 0;
                stream_checksum_prev = 0;
                if (cfg_keep_awake == 0) {
                    PORTC &= (uint8_t)~0x08;
                    PORTC |= 0x80;
                }
            } else {
                if (lights_pattern < 4 && cfg_keep_awake == 0) {
                    b_217 = 1;
                    adc_fault_flag = 0;
                }
                beep_queue_push(4, 9);
                if (lights_pattern & 0x01)
                    PORTC |= 0x08;
                else
                    PORTC &= (uint8_t)~0x08;
                if (lights_pattern & 0x02)
                    PORTC |= 0x04;
                else
                    PORTC &= (uint8_t)~0x04;
                if (lights_pattern & 0x04)
                    PORTC |= 0x80;
                else
                    PORTC &= (uint8_t)~0x80;
                if (lights_pattern & 0x08)
                    PORTA |= 0x20;
                else
                    PORTA &= (uint8_t)~0x20;
                if (lights_pattern & 0x10)
                    PORTA |= 0x10;
                else
                    PORTA &= (uint8_t)~0x10;
            }
        }
    }
}

/* ================== 0x18C0 : parse n hex digits ================== */
uint16_t hex_parse(const uint8_t *p, uint8_t n)
{
    uint16_t v = 0;
    do {
        v <<= 4;
        uint8_t c = *p++;
        uint16_t h = (c >= ':') ? (uint16_t)(c - 0x37) : (uint16_t)(c - 0x30);
        v |= h;
    } while (--n);
    return v;
}

/* ================== 0x18F2 : build buffer from serial_buf ==================
 * MATCHED at the pin (5.4.0+Atmel3.6.0): scorer 314/314 + link 314/314. Two forms decide it:
 *  1. i = 0 BEFORE `q = p + 4` (movw r16,r28 / subi / sbci): the PHI copy `i = 0` always
 *     follows the statements of the pre-header block, so a `q = p + 4` written before the loop
 *     comes first (306/314). It comes after only if `q = p + 4` sits INSIDE loop 1: the RTL
 *     loop-invariant pass then hoists it after the copy (and code hoisting merges it with the
 *     `p + 4` of the sum loop, which gives `movw r30,r16`). To keep it a real value in the loop
 *     (a single use `q[i]` is folded into p + (i + 4)), q gets a second use: the empty asm
 *     barrier, same trick as in buttons_scan. The sum loop then writes its base as the
 *     expression p[4 + i] (a loop-defined name q would make ivopts drop its counter: 264/314).
 *  2. the 16-bit word p[2..3] is loaded once (`t`): written as p[2] + p[3] each byte load is
 *     delayed to its use by TER and registers/order differ (300/314). */
void update_frame_decode(uint8_t *p)
{
    uint16_t v;
    uint16_t w;
    uint8_t i;
    uint8_t *q;

    v = hex_parse((const uint8_t *)0x011D, 4);
    v -= stream_key++;
    p[0] = (uint8_t)(v / 0xC5);

    v = hex_parse((const uint8_t *)0x0121, 4);
    v -= stream_key++;
    w = (uint16_t)((v / 0xC5) << 8);
    *(uint16_t *)(p + 2) = w;

    v = hex_parse((const uint8_t *)0x0125, 4);
    v -= stream_key++;
    w |= v / 0xC5;
    *(uint16_t *)(p + 2) = w;

    v = hex_parse((const uint8_t *)0x0129, 4);
    v -= stream_key++;
    p[1] = (uint8_t)(v / 0xC5);

    for (i = 0; i <= p[0]; i++) {
        q = p + 4;
        __asm__ __volatile__("" : : "r"(q));   /* 2nd use of q: required, see above */
        q[i] = (uint8_t)((hex_parse((const uint8_t *)(0x12D + ((uint16_t)i << 2)), 4) - stream_key++) / 0xC5);
    }

    {
        uint8_t sum = 0;
        for (i = 0; i != p[0]; i++)
            sum += p[4 + i];
        if (p[1] != 1) {
            uint16_t t = *(uint16_t *)(p + 2);
            uint8_t c = (uint8_t)-(uint8_t)(p[1] + (uint8_t)t + (uint8_t)(t >> 8) + i + sum);
            uint8_t s = p[4 + i];
            if (c != s)
                for (;;)
                    ;
        }
    }
}

/* ================== 0x1A2C : relay chaser ================== */
void lights_chase_step(void)
{
    if (PORTA & 0x10) {
        PORTA &= (uint8_t)~0x10;
        PORTA |= 0x20;
        return;
    }
    if (PORTA & 0x20) {
        PORTA &= (uint8_t)~0x20;
        PORTC |= 0x80;
        return;
    }
    if (PORTC & 0x80) {
        PORTC &= (uint8_t)~0x80;
        PORTC |= 0x04;
        return;
    }
    if (PORTC & 0x04) {
        PORTC &= (uint8_t)~0x04;
        PORTC |= 0x08;
        return;
    }
    if (PORTC & 0x08)
        PORTC &= (uint8_t)~0x08;
    PORTA |= 0x10;
}

/* ================== 0x1A5C : program sequencer (soft I2C) ================== */
void update_stream_step(void)
{
    uint16_t W;

    if (++timers_div4 == 4) {
        timers_div4 = 0;
        timers_update();
    }
    if (st_8c == 0) {
        if (delay_ticks == 0) {
            stream_checksum = 0;
            stream_key = 0x38;
            adc_fault_flag = 0;
            unk_b77 = 0;
            unk_w75 = 0;
            PORTA |= 0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
            st_8c = 1;
        }
        W = ((uint16_t)cmd_g_param << 9) | 0xFF;
        tx_shift_reg = W;
        goto END;
    }
    if (unk_b77 != 0)
        goto A2;
    if (cmd_e_pending != 0) {
        lights_chase_step();
        update_frame_decode((uint8_t *)0x77);
        cmd_e_pending = 0;
        if (b_1fe != 0) {
            b_1fe = 0;
            unk_w75 = unk_w79;
        }
        if (unk_w75 + 0x3F < unk_w79)
            unk_b77 = 0;
        if (unk_b78 == 1)
            unk_b77 = 1;
        unk_b74 = 0;
        UDR = '$';
    }
    if (b_1fe == 0)
        goto L6a4;
    W = ((uint16_t)cmd_g_param << 9) | 0xFF;
    tx_shift_reg = W;
    goto END;

A2:
    if (unk_b78 != 0)
        goto A2b;
    if (delay_ticks != 0)
        goto L6a4;
    if (unk_w75 < unk_w79) {
        stream_checksum--;
        W = 0x0200;
    } else {
        uint8_t t = *(const uint8_t *)(0x7B + unk_b74);
        stream_checksum += t;
        W = 0x0200 | (uint8_t)~t;
    }
    tx_shift_reg = W;
    if ((unk_w75 & 0x3F) == 0x3F)
        delay_ticks = 4;
    unk_w75++;
    if (unk_b77 == ++unk_b74)
        unk_b77 = 0;
    goto END;

L6a4:
    tx_shift_reg = 0x1E00;
    goto END;

A2b:
    if (unk_b78 != 1)
        goto END;
    if (unk_w75 & 0x3F) {
        unk_b74 = 0;
        stream_checksum--;
        tx_shift_reg = 0x0200;
        unk_w75++;
        goto END;
    }
    if (unk_b74 != 0xFF) {
        tx_shift_reg = (uint16_t)(uint8_t)~stream_checksum;
        unk_b74++;
        goto END;
    }
    ((void (*)(void))fnptr)();
    goto END;

END:
    tx_bits_left = 0x0E;
}

/* recon_C.c — byte-exact reconstruction of FUN_code_0637 @ 0x0C6E (564 bytes)
 * =======================================================================
 * Timer2 tick (~7.6 ms) of the CU Carrera Digital (ATmega16): tail-call of
 * timer2_tick_poll (0x0EA2).  See journal for the semantics.
 *
 * TOOLCHAIN : avr-gcc 5.4.0+Atmel3.6.0 (gcc54 container), -Os -mmcu=atmega16
 * METHOD    : symbolic (externs resolved at link), score.py masks the
 *             bytes with relocations.
 *
 * VALIDATED FORMS (experiments exp_C..exp6_C):
 *  - 32-bit tick: cli(); tick_clock32++; sei();                  -> lds x4/adiw/adc x2/sts x4
 *  - serial timeout: explicit buffer (deferred store after the if !)  (T1)
 *  - fixed path: ABSOLUTE variables (not cars[0] -> direct lds/4 sts)
 *  - indexed block: cars[(v-1)&7] + if/else (var_19F / 1)   (e1: exact!)
 *  - capture: buffer + cli/sei + memset((void*)arr,0,5)   (C2: exact!)
 */
#include <stdint.h>
#include <string.h>
#include <avr/io.h>
#include <avr/interrupt.h>

struct car {
    int16_t  pos;      /* 0x00 */
    uint32_t t02;      /* 0x02 : tick snapshot */
    uint32_t t06;      /* 0x06 */
    uint32_t t0a;      /* 0x0a */
    uint32_t t0e;      /* 0x0e */
    uint32_t b12;      /* 0x12 */
    uint32_t b16;      /* 0x16 */
    uint32_t b1a;      /* 0x1a */
    uint8_t  armed_chan;      /* 0x1e */
    uint8_t  last_chan;      /* 0x1f */
    uint8_t  rank;      /* 0x20 */
    uint8_t  rank_sent;      /* 0x21 */
    uint8_t  seen;      /* 0x22 */
};

/* ---- globals (addresses set by linker) ---- */
extern struct car cars[8];          /* 0x02BE, stride 0x23 */
extern volatile uint32_t tick_clock32;      /* 0x01B0 : 32-bit tick */
extern uint8_t serial_rx_timeout;                 /* 0x00E6 : RX frame timeout */
extern uint8_t serial_state;            /* 0x00E5 */
extern volatile uint8_t sm_state;       /* 0x0218 : state machine state */
extern volatile uint8_t g1bc;       /* 0x01BC */
extern volatile uint8_t cfg_slot_default;       /* 0x019F */
extern volatile uint8_t seq_step;       /* 0x0400 */
extern volatile uint8_t prog_mode_param;        /* 0x00E8 */
extern uint8_t lapsense_a_car_id;                /* 0x01A7 : captured pulse, channel A */
extern volatile uint8_t lapsense_b_car_id;       /* 0x01AC : captured pulse, channel B */
extern uint8_t lapsense_a_rearm;                /* 0x01A8 : capture countdown A */
extern uint8_t lapsense_b_rearm;                /* 0x01AD : capture countdown B */
extern volatile uint8_t capA[5];    /* 0x01A6 : capture state, channel A */
extern volatile uint8_t capB[5];    /* 0x01AB : capture state, channel B */

/* ---- fixed slots (path var_E8) ---- */
extern volatile uint32_t car0_pulse_time;      /* 0x02C0 = cars[0].t02 */
extern volatile uint8_t  car0_armed_chan;      /* 0x02DC = cars[0].armed_chan */
extern volatile uint32_t car1_prev_time;      /* 0x02E3 = cars[1].t02 */
extern volatile uint8_t  car1_last_chan;      /* 0x02FF = cars[1].armed_chan */

void beep_queue_push(uint8_t, uint8_t);        /* 0x0140 : pulse/filename? (see recon) */

void timer2_tick_service(void)
{
    cli();
    tick_clock32++;
    sei();

    {
        uint8_t t = serial_rx_timeout;
        if (t != 0) {
            if (--t == 0)
                serial_state = 0;
            serial_rx_timeout = t;
        }
    }

    if (lapsense_a_car_id != 0) {
        if (sm_state == 2) {
            if (g1bc != 0) {
                cfg_slot_default = seq_step;
                beep_queue_push(4, 6);
            }
        } else if (prog_mode_param != 0) {
            car0_pulse_time = tick_clock32;
            car0_armed_chan = 1;
        } else {
            uint8_t i = (lapsense_a_car_id - 1) & 7;
            cars[i].t02 = tick_clock32;
            if (g1bc != 0 && !(PINB & 2))
                cars[i].armed_chan = cfg_slot_default;
            else
                cars[i].armed_chan = 1;
        }
        lapsense_a_car_id = 0;
    }

    {
        uint8_t f = lapsense_b_car_id;
        if (lapsense_b_car_id != 0) {
            if (sm_state == 2) {
                if (g1bc != 0) {
                    cfg_slot_default = seq_step;
                    beep_queue_push(4, 6);
                }
            } else if (prog_mode_param != 0) {
                car1_prev_time = tick_clock32;
                car1_last_chan = 1;
            } else {
                uint8_t i = (f - 1) & 7;
                cars[i].t02 = tick_clock32;
                if (g1bc != 0 && !(PINB & 2))
                    cars[i].armed_chan = cfg_slot_default;
                else
                    cars[i].armed_chan = 1;
            }
            lapsense_b_car_id = 0;
        }
    }

    if (lapsense_a_rearm != 0) {
        uint8_t t = lapsense_a_rearm;
        if ((TIFR & 0x20) || (PIND & 0x40)) {
            TIFR = 0x20;
            lapsense_a_rearm = 5;
        } else {
            t--;
            cli();
            lapsense_a_rearm = t;
            sei();
            if (t == 0) {
                cli();
                TIMSK |= 0x20;
                sei();
                memset((void *)capA, 0, 5);
            }
        }
    }

    if (lapsense_b_rearm != 0) {
        uint8_t t = lapsense_b_rearm;
        if ((GIFR & 0x80) || (PIND & 0x08)) {
            GIFR = 0x80;
            lapsense_b_rearm = 5;
        } else {
            t--;
            cli();
            lapsense_b_rearm = t;
            sei();
            if (t == 0) {
                cli();
                GICR |= 0x80;
                sei();
                memset((void *)capB, 0, 5);
            }
        }
    }
}

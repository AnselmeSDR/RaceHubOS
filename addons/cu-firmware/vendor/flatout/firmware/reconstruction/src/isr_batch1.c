/* recon_isr.c — byte-exact reconstruction of the 3 ISRs of the V339 firmware
 * (Carrera Digital 124, ATmega16). Pinned toolchain: avr-gcc 4.8.1 -Os -mmcu=atmega16
 * (container gcc48), symbolic method: all globals are externs
 * resolved by the linker -> the addresses carry R_AVR_16 relocations,
 * masked in scoring (they resolve at link with the real layout).
 *
 * Integration: these three functions are declared respectively as
 *   ISR(USART_UDRE_vect)   (vector 12)
 *   ISR(TIMER1_CAPT_vect)  (vector 5)
 *   ISR(INT1_vect)         (vector 2)
 * The ISR_NAMED macro below = exact expansion of ISR() from avr-libc 1.8.0
 * (signal + used + externally_visible attributes), but keeps the requested name.
 */
#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>

#define ISR_NAMED(nom) \
    void nom(void) __attribute__((signal, used, externally_visible)); \
    void nom(void)

/* ---------- serial TX globals (addresses at link) ---------- */
extern volatile uint8_t serial_state;    /* 0x00E5 : TX state (2 = dump buffer) */
extern volatile uint8_t serial_rx_timeout;      /* 0x00E6 : counter tied to TX         */
extern volatile uint8_t *serial_ptr;     /* 0x011A : current parser pointer     */

/* ---------- Timer1 capture (rail measurement) ---------- */
extern volatile uint8_t lapsense_a_last;     /* 0x01A6 : last TCNT2 value          */
extern volatile uint8_t lapsense_a_car_id;   /* 0x01A7 : stable period found (÷16) */
extern volatile uint8_t lapsense_a_rearm;  /* 0x01A8 : timeout reset to 5        */
extern volatile uint8_t lapsense_a_prev;      /* 0x01A9 : last measured period (÷16) */
extern volatile uint8_t lapsense_a_seen;  /* 0x01AA : flag "first measurement done" */

/* ---------- INT1 (rail measurement) ---------- */
extern volatile uint8_t lapsense_b_last;     /* 0x01AB : last TCNT2 value          */
extern volatile uint8_t lapsense_b_car_id;   /* 0x01AC : stable period found (÷16) */
extern volatile uint8_t lapsense_b_rearm;  /* 0x01AD : timeout reset to 5        */
extern volatile uint8_t lapsense_b_prev;      /* 0x01AE : last measured period (÷16) */
extern volatile uint8_t lapsense_b_seen;  /* 0x01AF : flag "first measurement done" */

/* ===================== serial_tx_isr @ 0x064C (92 bytes) =====================
 * TX buffer drain: if the TX state is 2, sends *serial_ptr to UDR.
 * '#' or '$' = end of frame -> disables UDRIE (cbi UCSRB,5) and resets the state
 * to zero; otherwise advances the pointer and stays armed. */
ISR_NAMED(serial_tx_isr)
{
    if (serial_state == 2) {
        uint8_t c = *serial_ptr;
        UDR = c;
        if (c != '#' && c != '$') {
            serial_ptr++;
            return;
        }
    }
    UCSRB &= (uint8_t)~0x20;
    serial_state = 0;
    serial_rx_timeout = 0;
}

/* ================== lapsense_a_isr @ 0x0BA2 (102 bytes) =======================
 * Rail edge captured by ICR1: reads TCNT2, period = (TCNT2 + 8 - last)/16.
 * If two consecutive periods (÷16) are equal and non-zero -> sync:
 * disables TICIE1 (TIMSK &= ~0x20) and publishes the period. */
ISR_NAMED(lapsense_a_isr)
{
    uint8_t t = TCNT2;
    lapsense_a_rearm = 5;
    if (lapsense_a_seen) {
        uint8_t d = (uint8_t)(t + 8 - lapsense_a_last) >> 4;
        if (d == lapsense_a_prev && d != 0) {
            TIMSK &= (uint8_t)~0x20;
            lapsense_a_car_id = d;
        } else {
            lapsense_a_prev = d;
        }
    } else {
        lapsense_a_seen = 1;
    }
    lapsense_a_last = t;
}

/* ==================== lapsense_b_isr @ 0x0C08 (102 bytes) =====================
 * Same template as lapsense_a_isr, on INT1 edge; the sync disables INT1
 * (GICR &= ~0x80). */
ISR_NAMED(lapsense_b_isr)
{
    uint8_t t = TCNT2;
    lapsense_b_rearm = 5;
    if (lapsense_b_seen) {
        uint8_t d = (uint8_t)(t + 8 - lapsense_b_last) >> 4;
        if (d == lapsense_b_prev && d != 0) {
            GICR &= (uint8_t)~0x80;
            lapsense_b_car_id = d;
        } else {
            lapsense_b_prev = d;
        }
    } else {
        lapsense_b_seen = 1;
    }
    lapsense_b_last = t;
}

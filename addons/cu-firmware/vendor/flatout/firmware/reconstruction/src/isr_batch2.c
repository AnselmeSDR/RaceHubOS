/* recon_isr2.c — byte-exact reconstruction of 4 ISRs of firmware V339
 * (Carrera Digital 124, ATmega16).
 *
 * Toolchain: avr-gcc 4.9.2 -Os -mmcu=atmega16 (gcc49 container) —
 *   see COMPILER NOTE below: the 4 ISRs are only reproducible
 *   with the 4.9.x family (+ Atmel 5.4.0), NOT with 4.8.1.
 *   (4.8.1 reproduces ctl_pulse_window_isr/ctl_pulse0_isr/ctl_pulse2_isr but NOT serial_rx_isr: the IRA of
 *   4.8.1 never allocates c=r24 / pointer=r18:r19 for this function.)
 *
 * Symbolic method: all globals are externs resolved by the
 * linker -> the addresses carry R_AVR_16 relocations, masked in the
 * scoring (resolved in link_isr2.ld).
 *
 * Integration: these four functions are declared respectively as
 *   ISR(USART_RXC_vect)   (0x0566, vector 11)
 *   ISR(TIMER0_COMP_vect) (0x081A, vector 15)
 *   ISR(INT0_vect)        (0x091C, vector 1)
 *   ISR(INT2_vect)        (0x09CC, vector 3)
 * The ISR_NAMED macro = exact expansion of avr-libc's ISR() (signal +
 * used + externally_visible attributes), but keeps the requested name.
 */
#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>

#define ISR_NAMED(nom) \
    void nom(void) __attribute__((signal, used, externally_visible)); \
    void nom(void)

/* ---------- serial TX/RX globals (addresses set by linker) ---------- */
extern volatile uint8_t serial_state;    /* 0x00E5 : RX parser state */
extern volatile uint8_t serial_rx_timeout;      /* 0x00E6 : counter tied to transmission */
extern volatile uint8_t cmd_letter;    /* 0x0119 : last received command char */
extern volatile uint8_t *serial_ptr;     /* 0x011A : current parser pointer */
extern volatile uint8_t frame_quote_flag;      /* 0x011C : flag, reset to 0xFF */
extern volatile uint8_t serial_buf[];     /* 0x011D : RX/TX buffer (commands) */

/* ---------- rail measurement (Timer0 / INT0 / INT2) ---------- */
extern volatile uint8_t ctl_rx_bitcount;      /* 0x0188 */
extern volatile uint8_t ctl_rx_shift;      /* 0x0189 : rail shift register */
extern volatile uint8_t ctl_int2_filter;      /* 0x018A : INT0 filter counter */
extern volatile uint8_t ctl_rx_phase;      /* 0x018B : measurement state (0..3+) */
extern volatile uint8_t ctl_window_ticks;      /* 0x018C : window countdown */
extern volatile uint8_t ctl_rx_word;      /* 0x018D */
extern volatile uint8_t ctl_edge_flags;      /* 0x018E : rail flags */
extern volatile uint8_t ctl_int0_filter;      /* 0x018F : INT1 filter counter */

/* ================== serial_rx_isr @ 0x0566 (230 bytes) ========================
 * USART RXC: receives command characters.
 *  state 0: wait for '"' -> go to state 1 (start of command)
 *  state 1: store the char, dispatch: 0/?/I -> state 6;
 *           C/E/G/J/T/:/= -> serial_ptr = serial_buf, state 3; otherwise state 0 + '#'
 *           then if state 3, echo the char on UDR
 *  state 3: push the char into *serial_ptr++; '$' -> state 7
 *
 * FORM CONSTRAINT (GCC 4.9.2 idiom, cross-jumping of cfgcleanup):
 *  the nested switch MUST be written as 10 separate clauses (1 case per
 *  clause, no label grouping), and the FIRST clause must be
 *  '0' alone, the SECOND ':': cross-jumping then anchors the shared block
 *  `sts serial_state` on the block of group A (serial_ptr = serial_buf;
 *  serial_state = 3), which gives exactly the firmware layout:
 *    A: ldi r24,0x1D; ldi r25,1; sts 0x11B; sts 0x11A; ldi 3; sts E5; rjmp echo
 *    B: ldi 6; rjmp (returns into the sts of A)
 *  Any other grouping/order gives a different layout (2 to 16 bytes
 *  off). The order of the tail of the list ('?ICEGJT' below) is
 *  free: several orders produce the same bytes.
 */
ISR_NAMED(serial_rx_isr)
{
    uint8_t c = UDR;
    switch (serial_state) {
    case 0:
        if (c == '"') {
            serial_state = 1;
            frame_quote_flag = 0xFF;
            serial_rx_timeout = 0xFF;
        }
        break;
    case 1:
        cmd_letter = c;
        switch (cmd_letter) {
        case '0':
            serial_state = 6;
            break;
        case ':':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case '?':
            serial_state = 6;
            break;
        case '=':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case 'I':
            serial_state = 6;
            break;
        case 'C':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case 'E':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case 'G':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case 'J':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        case 'T':
            serial_ptr = serial_buf;
            serial_state = 3;
            break;
        default:
            serial_state = 0;
            UDR = '#';
            break;
        }
        if (serial_state == 3)
            UDR = cmd_letter;
        break;
    case 3:
        *serial_ptr++ = c;
        if (c == '$')
            serial_state = 7;
        break;
    }
}

/* ================== ctl_pulse_window_isr @ 0x081A (258 bytes) ========================
 * TIMER0 COMP: rail measurement window tick.
 *  ctl_window_ticks != 0: decrement; at 0x28 -> TCCR0 |= 0x10 (OC0 toggling),
 *    at 0x64 -> TCCR0 &= ~0x10; at 0 -> restart measurement (TCCR0, TCNT0),
 *    GIFR filter (INTF1 -> ctl_int0_filter, INTF0 -> ctl_int2_filter): the counter rises
 *    up to 3 (flag set) when the edge is seen, falls back to 0
 *    (flag cleared) otherwise, then re-arms INT0/INT1.
 *  ctl_window_ticks == 0: finish: disable OCIE0, publish ctl_rx_phase/ctl_rx_shift, re-arm.
 */
ISR_NAMED(ctl_pulse_window_isr)
{
    uint8_t n = ctl_window_ticks;
    if (n != 0) {
        n--;
        ctl_window_ticks = n;
        switch (n) {
        case 0: {
            uint8_t a, b;
            TCCR0 = 0x20;
            TCCR0 = 0xA0;
            TCCR0 = 0x03;
            TCNT0 = 0;
            a = ctl_int0_filter;
            if (GIFR & 0x40) {
                if (a < 3 && ++a == 3)
                    ctl_edge_flags |= 0x02;
            } else {
                if (a != 0 && --a == 0)
                    ctl_edge_flags &= (uint8_t)~0x02;
            }
            ctl_int0_filter = a;
            b = ctl_int2_filter;
            if (GIFR & 0x20) {
                if (b < 3 && ++b == 3)
                    ctl_edge_flags |= 0x01;
            } else {
                if (b != 0 && --b == 0)
                    ctl_edge_flags &= (uint8_t)~0x01;
            }
            ctl_int2_filter = b;
            ctl_rx_phase = 0;
            MCUCSR &= (uint8_t)~0x40;
            GIFR = 0x60;
            GICR |= 0x60;
            TIMSK &= (uint8_t)~0x02;
            break;
        }
        case 0x28:
            TCCR0 |= 0x10;
            break;
        case 0x64:
            TCCR0 &= (uint8_t)~0x10;
            break;
        }
    } else {
        TIMSK &= (uint8_t)~0x02;
        ctl_rx_bitcount = ctl_rx_phase;
        ctl_rx_word = ctl_rx_shift;
        ctl_rx_phase = 0;
        MCUCSR &= (uint8_t)~0x40;
        GIFR = 0x60;
        GICR |= 0x60;
    }
}

/* ================== ctl_pulse0_isr @ 0x091C (176 bytes) ======================
 * INT0 (PD2): rail pulse measurement (PD2 edge).
 *  state 0: if PD2 == 0 -> TCNT0 = TCNT0 - t, OCR0 = 125, TIFR = 2,
 *           OCIE0 on, disable INT0, state 1
 *  state 1: if PD2 == 1 -> TCNT0 = TCNT0 - t, OCR0 = 157, state 2
 *  state 2: if t >= 0x72 -> TCNT0 = TCNT0 - t, OCR0 = 97,
 *           ctl_rx_shift = (ctl_rx_shift << 1) | (PD2), state 3
 *  other  : if t >= 0x31 -> TCNT0 = TCNT0 - t, state++,
 *           ctl_rx_shift = (ctl_rx_shift << 1) | (PD2)
 *  (t = TCNT0 captured first; the new state is published at the end.)
 */
ISR_NAMED(ctl_pulse0_isr)
{
    uint8_t t = TCNT0;
    uint8_t s = ctl_rx_phase;
    switch (s) {
    case 0:
        if ((PIND & 4) == 0) {
            TCNT0 -= t;
            OCR0 = 0x7D;
            TIFR = 2;
            TIMSK |= 2;
            GICR &= (uint8_t)~0x20;
            s = 1;
        }
        break;
    case 1:
        if (PIND & 4) {
            TCNT0 -= t;
            OCR0 = 0x9D;
            s = 2;
        }
        break;
    case 2:
        if (t >= 0x72) {
            TCNT0 -= t;
            OCR0 = 0x61;
            ctl_rx_shift = (uint8_t)((ctl_rx_shift << 1) | ((PIND >> 2) & 1));
            s = 3;
        }
        break;
    default:
        if (t >= 0x31) {
            TCNT0 -= t;
            s++;
            ctl_rx_shift = (uint8_t)((ctl_rx_shift << 1) | ((PIND >> 2) & 1));
        }
        break;
    }
    ctl_rx_phase = s;
}

/* ================== ctl_pulse2_isr @ 0x09CC (194 bytes) ======================
 * INT2 (PB2): same measurement as ctl_pulse0_isr, on PB2; toggles ISC2
 * (MCUCSR bit 6, edge sense) at each interrupt; in state 0 disables
 * INT1 (GICR &= ~0x40).
 */
ISR_NAMED(ctl_pulse2_isr)
{
    uint8_t t = TCNT0;
    if (MCUCSR & 0x40)
        MCUCSR &= (uint8_t)~0x40;
    else
        MCUCSR |= 0x40;
    {
        uint8_t s = ctl_rx_phase;
        switch (s) {
        case 0:
            if ((PINB & 4) == 0) {
                TCNT0 -= t;
                OCR0 = 0x7D;
                TIFR = 2;
                TIMSK |= 2;
                GICR &= (uint8_t)~0x40;
                s = 1;
            }
            break;
        case 1:
            if (PINB & 4) {
                TCNT0 -= t;
                OCR0 = 0x9D;
                s = 2;
            }
            break;
        case 2:
            if (t >= 0x72) {
                TCNT0 -= t;
                OCR0 = 0x61;
                ctl_rx_shift = (uint8_t)((ctl_rx_shift << 1) | ((PINB >> 2) & 1));
                s = 3;
            }
            break;
        default:
            if (t >= 0x31) {
                TCNT0 -= t;
                s++;
                ctl_rx_shift = (uint8_t)((ctl_rx_shift << 1) | ((PINB >> 2) & 1));
            }
            break;
        }
        ctl_rx_phase = s;
    }
}

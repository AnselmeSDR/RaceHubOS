/* setup.c — buzzer timer mode (0x0122) and serial port init (0x01CE).
 * Carrera Digital CU V339 (ATmega16), avr-gcc 5.4.0+Atmel3.6.0 -Os.
 * Both byte-exact at link (see functions.tsv).
 */
#include <stdint.h>
#include <avr/io.h>

extern volatile uint8_t serial_state;   /* 0x00E5 : serial parser state      */
extern volatile uint8_t button_cmd;     /* 0x00D9 : set by the 'T' command    */
void event_ring_reset(void);            /* 0x01A6 */

/* 0x0122 (30 B): Timer2 drives the buzzer on OC2 (PD7). Mode 2 and 4 set the
 * compare value and a CTC toggle prescaler; anything else leaves it stopped. */
void buzzer_set_mode(uint8_t mode)
{
    uint8_t ctrl;

    switch (mode) {
    case 4:
        OCR2 = 0x7F;
        ctrl = 0x7B;
        break;
    case 2:
        OCR2 = 0xFF;
        ctrl = 0x1B;
        break;
    default:
        ctrl = 0x03;
        break;
    }
    TCCR2 = ctrl;
}

/* 0x01CE (28 B): USART at 38400 baud (16 MHz, UBRR = 25), RX + RX interrupt +
 * TX, 8N1; clears the parser state and the event ring. */
void serial_init(void)
{
    serial_state = 0;
    button_cmd = 0;
    UCSRA = 0;
    UCSRB = 0x98;
    UCSRC = 0x86;           /* URSEL = 1: write UCSRC */
    UBRRH = 0;              /* URSEL = 0: same I/O address, writes UBRRH */
    UBRRL = 0x19;
    event_ring_reset();
}

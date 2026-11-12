/* recon6.c — batch 3: parameter parser (0x24A), stop-timer (0xB02), PROG frame (0xB5C) */
#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>

extern char serial_buf[];              /* 0x011D */
extern uint8_t rank_mode;          /* 0x01B6 */
extern uint8_t ctl_window_ticks;          /* 0x018C */
extern void car_table_reset(void);         /* 0x13DC */
extern void event_ring_reset(void);         /* 0x01A6 */
uint8_t sum_bytes(uint8_t *p, uint8_t n);   /* 0x0B44 */

/* r6 — cmd param @0x024A (66 bytes) */
void r6(void)
{
    uint8_t v = (uint8_t)(serial_buf[0] - '0');
    serial_buf[0] = v;
    if (v & 1) {
        car_table_reset();
        event_ring_reset();
    }
    v = serial_buf[0];
    if (v & 2)
        rank_mode = 1;
    else
        rank_mode = 0;
    if (v & 8) {
        car_table_reset();
        event_ring_reset();
    }
    serial_buf[1] = (uint8_t)(serial_buf[1] - '0');
}

/* ctl_window_start — stop-timer/reconfig @0x0B02 (66 bytes) */
void ctl_window_start(void)
{
    cli();
    GICR &= (uint8_t)~0x60;
    TIMSK &= (uint8_t)~0x02;
    sei();
    MCUCR |= 0x01;
    MCUCSR &= (uint8_t)~0x40;
    GIFR = 0x60;
    TCCR0 = 0;
    TCNT0 = 0;
    OCR0 = 0x68;
    ctl_window_ticks = 0xA0;
    TIFR = 0x02;
    cli();
    TIMSK |= 0x02;
    sei();
    TCCR0 = 0x19;
}

/* prog_buf_set_defaults_v2 — PROG frame: individual byte stores @0x0B5C (70 bytes) */
void prog_buf_set_defaults_v2(char *p)
{
    p[0] = ' ';  p[1] = '>';
    p[2] = ' ';  p[3] = '>';
    p[4] = ' ';  p[5] = '>';
    p[6] = ' ';  p[7] = '>';
    p[8] = ' ';  p[9] = '>';
    p[10] = ' '; p[11] = '>';
    p[12] = 1; p[13] = 9; p[14] = 9; p[15] = 1;
    p[16] = 8; p[17] = 0; p[18] = 1;
    p[19] = (char)sum_bytes((uint8_t *)p, 19);
}

/* prog_buf_set_defaults_v1 — PROG frame: 16-bit stores 0x3E20 */
void prog_buf_set_defaults_v1(char *p)
{
    *(uint16_t *)(p + 0) = 0x3E20;
    *(uint16_t *)(p + 2) = 0x3E20;
    *(uint16_t *)(p + 4) = 0x3E20;
    *(uint16_t *)(p + 6) = 0x3E20;
    *(uint16_t *)(p + 8) = 0x3E20;
    *(uint16_t *)(p + 10) = 0x3E20;
    p[12] = 1; p[13] = 9; p[14] = 9; p[15] = 1;
    p[16] = 8; p[17] = 0; p[18] = 1;
    p[19] = (char)sum_bytes((uint8_t *)p, 19);
}

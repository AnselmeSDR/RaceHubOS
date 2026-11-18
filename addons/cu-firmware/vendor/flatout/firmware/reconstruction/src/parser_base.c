/* recon1.c — batch 1 reconstruction (symbolic method, GCC 4.7.x -Os)
 * One file per batch; addresses left to the linker (relocs masked in scoring).
 */
#include <stdint.h>
#include <avr/io.h>

/* ---- globals (resolved by the linker) ---- */
extern char serial_buf[];          /* 0x011D : TX reply buffer */
extern uint8_t button_cmd;        /* 0x00D9 : joystick key/ID (cf. init 0x1CE) */

/* ---- firmware externals ---- */
extern void timer2_tick_service(void);     /* 0x0C6E (tail-call from timer2_tick_poll) */

/* 1 — cmd_button_set @0x033A (12 bytes) */
void cmd_button_set_v0(void)
{
    button_cmd = (uint8_t)(serial_buf[0] - '0');
}

/* 2 — reply_append_checksum @0x01EA (24 bytes): sum + checksum('0'+nibble) + '$' */
void reply_append_checksum(char *buf)
{
    char *p = buf;
    uint8_t sum = 0;
    while (p[1] != '$')
        sum += (uint8_t)*p++;
    *p = (char)((sum & 0x0F) | '0');
}

/* 3 — FUN_code_0751 @0x0EA2 (22 bytes): Timer2 overflow → adjust + tail */
void timer2_tick_poll(void)
{
    if (TIFR & 0x40) {
        TIFR = 0x40;
        TCNT2 += 6;
        timer2_tick_service();
    }
}

/* 4 — FUN_code_05a2 @0x0B44 (24 bytes): sum over n bytes */
uint8_t sum_bytes_v0(uint8_t *p, uint8_t n)
{
    uint8_t *end = p + n;
    uint8_t sum = 0;
    while (p < end)
        sum += *p++;
    return sum;
}

/* 5 — FUN_code_0946 @0x128C (34 bytes): arm Timer1 capture + INT1 */
void lapsense_capture_arm(void)
{
    TCCR1B |= 0x40;
    TIFR = 0x20;
    TIMSK |= 0x20;
    MCUCR |= 0x0C;
    *(volatile uint8_t *)0x5A = 0x80;
    GICR |= 0x80;
}

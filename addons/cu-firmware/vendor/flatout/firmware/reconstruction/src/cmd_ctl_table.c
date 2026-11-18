/* cmd_ctl_table_set (command 'C') @0x0346, 46 bytes. Byte-exact at link (linkcheck.py: 46/46).
 *
 * The C form that mattered: the empty asm pin "+z"(src) right after the src
 * initialisation. It makes src a real value before dst is set, so the
 * pointers are loaded in the original order (Z = serial_buf at 0x0346,
 * then X = ctl_cmd_table). Without the pin GCC loads X first (40/46).
 * Pinned compiler: avr-gcc 5.4.0+Atmel3.6.0, -Os -mmcu=atmega16.
 */
#include <stdint.h>

extern char serial_buf[];          /* 0x011D */
extern uint8_t ctl_cmd_table[];    /* 0x00DD */
extern uint8_t ctl_table_stamp;    /* 0x017D */

void cmd_ctl_table_set(void)
{
    uint8_t *src = (uint8_t *)serial_buf;
    __asm__ __volatile__("" : "+z"(src));
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        uint8_t b = (uint8_t)((src[1] == '1') ? 0x10 : 0x00);
        *dst++ = (uint8_t)(v | b);
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

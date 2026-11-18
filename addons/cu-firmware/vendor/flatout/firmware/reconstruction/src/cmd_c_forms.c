/* tsymcv.c — cmd_ctl_table_set variants for 5.4.0 */
#include <stdint.h>
extern char serial_buf[];
extern uint8_t ctl_cmd_table[];
extern uint8_t ctl_table_stamp;

void cmd_ctl_table_set_v1(void)   /* current form (y3) */
{
    uint8_t *src = (uint8_t *)serial_buf;
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        uint8_t b = 0x00;
        if (src[1] != '1') b = 0x00; else b = 0x10;
        *dst++ = (uint8_t)(v | b);
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

void cmd_ctl_table_set_v2(void)   /* if b=0x10 else 0 */
{
    uint8_t *src = (uint8_t *)serial_buf;
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        uint8_t b;
        if (src[1] == '1') b = 0x10; else b = 0x00;
        *dst++ = (uint8_t)(v | b);
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

void cmd_ctl_table_set_v3(void)   /* v |= */
{
    uint8_t *src = (uint8_t *)serial_buf;
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        if (src[1] == '1') v |= 0x10;
        *dst++ = v;
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

void cmd_ctl_table_set_v4(void)   /* ternary */
{
    uint8_t *src = (uint8_t *)serial_buf;
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        uint8_t b = (uint8_t)((src[1] == '1') ? 0x10 : 0x00);
        *dst++ = (uint8_t)(v | b);
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

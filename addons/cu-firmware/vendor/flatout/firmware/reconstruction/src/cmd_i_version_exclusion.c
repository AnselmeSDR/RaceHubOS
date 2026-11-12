/* tsym.c — test: buffer = global SYMBOL (resolved to 0x011D by the linker) */
#include <stdint.h>
#include <avr/pgmspace.h>

extern char serial_buf[];          /* -> 0x011D (via test linker script) */
extern char *serial_ptr;          /* -> 0x011A */
extern const char id339[];    /* -> 0x37FB (progmem) */
void reply_append_checksum(char *);

/* cmd_i_send @0x0540: symbolic version */
__attribute__((noinline))
void cmd_i_send_v0(void)
{
    char *buf = serial_buf;
    buf[0] = 'I';
    buf[1] = 0;
    buf[2] = '$';
    reply_append_checksum(buf);
    serial_ptr = buf;
}

/* cmd_version_send @0x0202: symbolic version */
__attribute__((noinline))
void cmd_version_send_v0(void)
{
    char *buf = serial_buf;
    buf[0] = '5';
    strcpy_P(buf + 1, id339);
    buf[5] = '$';
    reply_append_checksum(buf);
    serial_ptr = buf;
}

/* cmd_ctl_table_set @0x0346: symbolic version */
extern uint8_t ctl_cmd_table[];    /* -> 0x00DD */
extern uint8_t ctl_table_stamp;      /* -> 0x017D */
__attribute__((noinline))
void cmd_ctl_table_set_v0(void)
{
    uint8_t *src = (uint8_t *)serial_buf;
    uint8_t *dst = ctl_cmd_table;
    do {
        uint8_t v = (uint8_t)(src[0] - '0');
        uint8_t b = 0x00;
        if (src[1] != '1')
            b = 0x00;
        else
            b = 0x10;
        *dst++ = (uint8_t)(v | b);
        src += 2;
    } while (src != (uint8_t *)(serial_buf + 12));
    ctl_table_stamp = 0x3C;
}

/* cmd_exclusion_set @0x0232: symbolic, NON-volatile */
__attribute__((noinline))
void cmd_exclusion_set_v0(void)
{
    uint8_t *p = (uint8_t *)serial_buf;
    uint8_t hi = p[1];
    uint8_t lo = (uint8_t)(p[0] - '0');
    *(volatile uint8_t *)0x0212 = (uint8_t)(lo + hi * 16);
}

/* cmd_exclusion_set: symbolic VOLATILE */
__attribute__((noinline))
void cmd_exclusion_set_v1(void)
{
    volatile uint8_t *p = (volatile uint8_t *)serial_buf;
    uint8_t hi = p[1];
    uint8_t lo = (uint8_t)(p[0] - '0');
    *(volatile uint8_t *)0x0212 = (uint8_t)(lo + hi * 16);
}

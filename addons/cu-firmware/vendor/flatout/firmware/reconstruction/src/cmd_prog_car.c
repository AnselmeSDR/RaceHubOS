/* cmd_J @0x028C (174 bytes) — programming command: prog table @0x190 + race slot @0x021C.
 * Score: 174/174 MATCH with the pinned compiler (avr-gcc 5.4.0+Atmel3.6.0, -Os);
 * linked at 0x028C it is also 174/174 identical to the stock image.
 * Previous best: 152/174 (table indexed by the uint8 `a`, slot store with +9 folded
 * into the literal 0x0225 instead of a displacement).
 * Key forms: table indexed by the zero-extended `a16`; slot store through a local
 * pointer so the +9 field offset stays a displacement (std Z+9 / std Z+10). */
#include <stdint.h>

extern uint8_t serial_buf[];
extern uint8_t sm_state;
extern uint8_t flag_213;
extern uint8_t prog_mode_param;
extern uint16_t prog_ticks[];

void inject_queue_push(uint8_t a, uint8_t b, uint8_t c);

void cmd_prog_car(void)
{
    uint8_t a = (uint8_t)(serial_buf[1] * 16) + (uint8_t)(serial_buf[0] - '0');
    uint8_t b = (uint8_t)(serial_buf[2] - '0');
    uint8_t c = (uint8_t)(serial_buf[3] - '0');
    uint16_t v;

    inject_queue_push(a, b, c);

    if ((a & 0x0F) == 2 && !(a & 0x10) && a < 0xC0) {
        uint16_t a16;
        if (b < 2)
            b = 8;
        a = (uint8_t)(a >> 5);
        a16 = a;
        v = (uint16_t)(b * 0x07C4);
        prog_ticks[a16] = v;
        /* race slot a16 at 0x021C (16 bytes), 16-bit value at +9 */
        { uint8_t *slot = (uint8_t *)0x021C + (a16 << 4); *(uint16_t *)(slot + 9) = v; }
    }
    if ((a & 0x0F) < 4 && !(a & 0x10) && a < 0xC0)
        sm_state = 8;

    if (a == 6) {
        if (b == 9)
            flag_213 = 1;
    } else if (a == 0xF5) {
        prog_mode_param = b;
    }
}

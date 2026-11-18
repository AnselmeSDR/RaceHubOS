/* button_event.c — reconstruction of button_event_get @ 0x14D8 (76 bytes, 0x14D8-0x1523)
 * Carrera Digital CU V339 (ATmega16), avr-gcc 5.4.0+Atmel3.6.0 -Os.
 * Link score: scorer 76/76 + linkcheck 76/76  ✅ MATCH.
 *
 * What it does (one call = one scan of the buttons):
 *   c = buttons_scan()                    the code of the button held now (1-8), 0 = none
 *   latch 0x006E set (a press was seen on the previous scan):
 *       no button now -> latch decremented (released), button now -> latch = 1;
 *       returns 0: a held button produces one event only (edge detection, no repeat)
 *   latch clear, button held -> latch = 1, idle_timeout_service(), return c (the event)
 *   latch clear, no button   -> if button_cmd (0x00D9, set by the serial 'T' command) is
 *       nonzero, it is cleared and returned as the event (after idle_timeout_service());
 *       otherwise return 0.
 * The latch is not named in docs/glossary.md; it is named here after its role.
 *
 * C forms that mattered (5.4.0+Atmel3.6.0, -Os):
 *   - `uint8_t x = button_latch;` read ONCE, after buttons_scan(): reading it again in the
 *     assignment (`if (button_latch != 0) { x = button_latch; ...}`) gives 82 B (two lds);
 *   - `if (c == 0) x--; else x = 1;` (the stock's cpse + rjmp layout);
 *   - the empty asm barrier `__asm__ __volatile__("" : "+r"(x));` right after the x != 0
 *     block: it keeps x opaque, so `return x;` at the end is the register r24 already
 *     holding 0 (the original's shared `pop r28; ret` exit with no ldi). Without it GCC folds
 *     x to the constant 0 and emits a separate `ldi r24,0` + rjmp (78 B). A barrier at the
 *     end (just before `return x;`) gives 80 B;
 *   - `button_cmd` read twice (`if (button_cmd != 0) { c = button_cmd; button_cmd = 0; ...}`),
 *     which needs the volatile declaration (the original re-reads it);
 *   - `button_latch` volatile (as the other button-state RAM of the firmware); the
 *     non-volatile declaration gives the same bytes.
 */
#include <stdint.h>

extern volatile uint8_t button_latch;    /* 0x006E : press latch, 1 while a button is seen held */
extern volatile uint8_t button_cmd;      /* 0x00D9 : set by the 'T' command (serial_buf[0] - '0') */
uint8_t buttons_scan(void);              /* 0x144C : returns the button code 1-8, 0 = none */
void idle_timeout_service(void);         /* 0x15B0 : reloads idle_timeout (0x02BC) to 0x3CF0 */

uint8_t button_event_get(void)
{
    uint8_t c = buttons_scan();
    uint8_t x = button_latch;
    if (x != 0) {
        if (c == 0) x--; else x = 1;
        button_latch = x;
        return 0;
    }
    __asm__ __volatile__("" : "+r"(x));   /* keeps x in r24: `return x` below is 0 without ldi */
    if (c != 0) {
        button_latch = 1;
        idle_timeout_service();
        return c;
    }
    if (button_cmd != 0) {
        c = button_cmd;
        button_cmd = 0;
        if (c != 0) {
            idle_timeout_service();
            return c;
        }
    }
    return x;
}

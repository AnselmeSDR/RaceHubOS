/* ready_check.c — 0x1C44, 50 bytes (0x1C44-0x1C75), avr-gcc 5.4.0+Atmel3.6.0 -Os.
 *
 * uint8_t ready_check(void): the start-ready test of the state machine. Returns 1 when
 *   ta_off_flag != 0          (set by a reply bit 0 inside the start window, main_loop.c)
 *   AND a start button is held (btn_c6_held or btn_b0_held, buttons_scan, gated by cfg_btn_enable)
 *   AND (frame_quote_flag == 0  OR  flag_213 != 0)
 * ("frame_quote_flag" = a '"' frame in progress; flag_213 = set by cmd J word 6 = 9).
 * Otherwise returns 0. The state machine calls it in states 5, 24 and 32 and only
 * re-arms the slots / injects the words when it is nonzero.
 *
 * C forms that mattered at the pin (see docs/method.md):
 *  - the early exits are `goto out` to one `return r` with `uint8_t r = 0`: a plain
 *    `if (...) return 0;` lets GCC send the ta_off / button branches straight to the final
 *    `ret` (the firmware has its own `ldi r24,0; ret` block for them)
 *  - only flag_213 is volatile: with it volatile the `lds r25` comes before the `ldi r24,1`
 *    (the firmware order); with every extern volatile the early branches are wrong again
 * Link: linkcheck.py 50/50 and score.py 50/50 (MATCH).
 */
#include <stdint.h>

extern uint8_t btn_b0_held;               /* 0x01B4 */
extern uint8_t btn_c6_held;               /* 0x01B5 */
extern uint8_t ta_off_flag;               /* 0x020F */
extern uint8_t frame_quote_flag;          /* 0x011C */
extern volatile uint8_t flag_213;         /* 0x0213 */

uint8_t ready_check(void)
{
    uint8_t r = 0;

    if (ta_off_flag == 0)
        goto out;
    if (btn_c6_held == 0 && btn_b0_held == 0)
        goto out;
    if (frame_quote_flag == 0) {
        r = 1;
        goto out;
    }
    r = flag_213 != 0;
out:
    return r;
}

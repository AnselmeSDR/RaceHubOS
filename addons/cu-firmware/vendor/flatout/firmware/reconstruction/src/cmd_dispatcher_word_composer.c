/* recon_lay.c — SOLUTION LAY (agent): dispatcher 0x06A8 + compositor 0x0754
 * =====================================================================
 * TOOLCHAIN: avr-gcc 4.8.1+Atmel3.4.5 (container `gcc54`), -Os -mmcu=atmega16,
 *             default flags (NO -fno-regmove: unnecessary with the Atmel build!).
 * PROOF:     link at the real address -> linked image IDENTICAL to firmware:
 *             dispatcher 0x6A8 (172 bytes): 0 diff
 *             compositor 0x754 (198 bytes): 0 diff
 * =====================================================================
 * Note: with the Debian gcc-avr (container gcc48), the compositor can
 * NOT be reproduced byte-exact (best = 188/198 with -fno-regmove + a
 * slightly different w form) -> the firmware comes from Atmel's AVR build.
 */
#include <stdint.h>
#include <avr/io.h>

/* ---- TX / parser globals ---- */
extern uint8_t serial_state, rx_byte, serial_rx_timeout, cmd_g_param, cmd_e_pending, sm_state;
extern char serial_buf[];
void cmd_status_send(void); void cmd_timer_reset(void); void cmd_prog_car(void);
void cmd_i_send(void); void cmd_version_send(void); void cmd_exclusion_set(void);
void cmd_button_set(void); void cmd_ctl_table_set(void);

/* ==================== dispatcher @ 0x06A8 (172 bytes) ====================
 * Key idiom (case 6 and case 7): the body of the inner switch is placed
 * OUT-OF-LINE, branches TAKEN to the bodies (breq/brcc). The order of the
 * case labels of switch case 7 is IMPOSED by the target layout: = E J T C : G
 * (the cases are sorted into a decision tree by GCC, but their source order
 *  determines the order of the out-of-line blocks: = E J T C, ':' and 'G' inline).
 * For case 6: inner switch '?' 'I' '0' (the pivot '?' is tested first,
 * then 'I' then '0' — identical to the target).
 */
void cmd_dispatch(uint8_t unused)
{
    switch (serial_state) {
    case 6: {
        switch (rx_byte) {
        case '?': cmd_status_send(); break;
        case 'I': cmd_i_send(); break;
        case '0': cmd_version_send(); break;
        default: goto reply;
        }
        serial_state = 2;
    reply:
        UDR = rx_byte;
        UCSRB |= 0x20;
        break;
    }
    case 7:
        serial_rx_timeout = 0;
        switch (rx_byte) {
        case '=': cmd_timer_reset(); break;
        case 'E': cmd_e_pending = 1; break;
        case 'J': cmd_prog_car(); break;
        case 'T': cmd_button_set(); break;
        case 'C': cmd_ctl_table_set(); break;
        case ':': cmd_exclusion_set(); break;
        case 'G': cmd_g_param = (uint8_t)(serial_buf[0] - '0'); sm_state = 5; break;
        default: break;
        }
        if (rx_byte != 'E') UDR = '$';
        serial_state = 0;
        break;
    }
}

/* ==================== compositor @ 0x0754 (198 bytes) ====================
 * w = 1 if (btn_c6_held||btn_b0_held) && ta_off_flag==0 — BUT the form that reproduces
 * the target code is the negation: (!(a||b) || flag) ? 0 : 1  (speculative
 * store of w=1, then branch to the merge if flag==0).
 * ta_off_flag is VOLATILE (forces the order: lds flag before the ldi).
 * The slot pointer computation is DUPLICATED in both branches (Atmel 4.8.1
 * does not CSE it — with Debian 4.8.1 it does, hence the divergence) and
 * RECOMPUTED at the end; the <<4/<<1 shifts are dec/brne loops (-Os),
 * including the last <<4 done IN PLACE on r20:r21.
 */
extern uint8_t btn_c6_held;        /* 0x01B5 */
extern uint8_t btn_b0_held;        /* 0x01B4 */
extern volatile uint8_t ta_off_flag; /* 0x020F */
#define SLOTS 0x021C

void slot_word_compose(uint8_t id, uint8_t which)
{
    uint16_t w;
    uint8_t *st;
    uint8_t a, b, i, t;

    w = (!(btn_c6_held != 0 || btn_b0_held != 0) || ta_off_flag != 0) ? 0 : 1;

    if (which) {
        st = (uint8_t *)((uint16_t)(SLOTS + ((uint16_t)id << 4)));
        a = st[4];
        b = st[5];
    } else {
        st = (uint8_t *)((uint16_t)(SLOTS + ((uint16_t)id << 4)));
        a = st[0];
        b = st[1];
    }
    for (i = 0; i < 4; i++) {
        w <<= 1;
        w |= (a & 1);
        a >>= 1;
    }
    w <<= 1;
    w |= (b & 1);

    t = id;
    for (i = 0; i < 3; i++) {
        w <<= 1;
        w |= (t & 1);
        t >>= 1;
    }
    st = (uint8_t *)((uint16_t)(SLOTS + ((uint16_t)id << 4)));
    st[6] = 9;
    *(uint16_t *)(st + 14) = w;
}

/* recon9.c v2 — 9-bit compositor: <<4 + pointer per branch */
#include <stdint.h>

extern uint8_t btn_c6_held;        /* 0x01B5 */
extern uint8_t btn_b0_held;        /* 0x01B4 */
extern uint8_t ta_off_flag;       /* 0x020F */

#define SLOTS 0x021C

void slot_word_compose(uint8_t id, uint8_t which)
{
    uint16_t w;
    uint8_t *st;
    uint8_t a, b, i, t;

    if (btn_c6_held != 0 || btn_b0_held != 0)
        w = (ta_off_flag == 0) ? 1 : 0;
    else
        w = 0;

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

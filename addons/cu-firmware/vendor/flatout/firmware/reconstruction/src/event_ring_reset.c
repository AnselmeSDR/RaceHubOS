/* f01a6v.c — 0x01A6 forms for 5.4.0 */
#include <stdint.h>
extern uint8_t slots[];       /* 0x00E9 */
extern uint8_t *event_ring_rd, *event_ring_wr;

void event_ring_reset_v1(void)           /* index form (mentioned by the agent) */
{
    uint8_t i;
    for (i = 0; i < 48; i += 6)
        slots[i] = 8;
    event_ring_rd = (uint8_t *)0x00E9;
    event_ring_wr = (uint8_t *)0x00E9;
}

void event_ring_reset_v2(void)           /* literal pointer form */
{
    uint8_t *p;
    for (p = (uint8_t *)0x00E9; p != (uint8_t *)0x0119; p += 6)
        p[0] = 8;
    event_ring_rd = (uint8_t *)0x00E9;
    event_ring_wr = (uint8_t *)0x00E9;
}

void event_ring_reset_v3(void)          /* literal pointer + < */
{
    uint8_t *p;
    for (p = (uint8_t *)0x00E9; p < (uint8_t *)0x0119; p += 6)
        p[0] = 8;
    event_ring_rd = (uint8_t *)0x00E9;
    event_ring_wr = (uint8_t *)0x00E9;
}

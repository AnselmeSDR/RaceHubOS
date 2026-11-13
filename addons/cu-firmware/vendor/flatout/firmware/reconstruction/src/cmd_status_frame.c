/* cmd_status_send: the '?' status frame at 0x0374 (460 bytes).
 *
 * MATCHED with the pinned avr-gcc 5.4.0 + Atmel 3.6.0 (-Os -mmcu=atmega16):
 * score.py 460/460 and linkcheck.py 460/460.
 *
 * The C forms that matter here:
 *  - event_ring_rd is read once into a local `ev` (Z register), as in the original.
 *  - Branch B starts with an empty memory clobber so ev[0] is reloaded (ld r24, Z).
 *  - Empty asm "+r" pins keep constants and loads in the original register order:
 *    z = '0' (kept in r24 across the sm_state compare), i = 3, f5 = SLOTS[5] load.
 *  - status_byte_219 is volatile (the original reads it twice).
 *  - The ring wrap compares against a SYMBOL, `ev == &event_ring[42]`: the high byte
 *    is then loaded before the cpi (`ldi r24,1; cpi r30,0x13; cpc r31,r24`), as in the
 *    original. Against the constant 0x0113 the compare insn emits cpi, ldi, cpc (456/460).
 */
#include <stdint.h>
#include <avr/io.h>

extern volatile uint8_t serial_buf[];
extern uint8_t *event_ring_rd;
extern uint8_t event_ring[];              /* 0x00E9 : 8 entries x 6 bytes */
extern volatile uint8_t *serial_ptr;
extern volatile uint8_t sm_state;
extern volatile uint8_t btn_c6_held, btn_b0_held, ta_off_flag;
extern uint8_t cfg_car_count;
extern volatile uint8_t status_byte_219;
void reply_append_checksum(char *buf);

struct slot16 {
    uint8_t throttle, sw, bot_throttle, bot_spare, throttle_alt, sw_alt, bit_count, period_lo;
    uint8_t period_hi, prog_ticks_lo, prog_ticks_hi, status_a, reply_flag, spare13, word_lo, word_hi;
};
#define SLOTS ((struct slot16 *)0x021C)
#define SLOT16(i) ((struct slot16 *)(0x021C + ((uint16_t)(i) << 4)))

void cmd_status_send(void)
{
    uint8_t i, v;
    char *p;

    uint8_t *ev = event_ring_rd;

    if (ev[0] == 8) {
        serial_buf[0] = ':';
        p = (char *)&serial_buf[1];
        {
            uint16_t k;
            for (k = 0; k < 6; k++)
                *p++ = (char)(SLOT16(k)->status_a + 0x30);
        }
        {
            char z = '0';
            __asm__ volatile("" : "+r"(z));
            serial_buf[7] = z;
            serial_buf[8] = z;
            if (sm_state >= 24)
                z = (char)(sm_state - 0xE7);
            serial_buf[9] = z;
        }
        serial_buf[10] = '0';
        if (btn_c6_held)
            serial_buf[10] = '1';
        if (btn_b0_held)
            serial_buf[10] += 2;
        if (ta_off_flag)
            serial_buf[10] += 4;
        if (PINB & 2)
            serial_buf[10] += 8;
        i = 3;
        __asm__ volatile("" : "+r"(i));
        v = 0;
        do {
            v = (uint8_t)(v << 1);
            if (SLOTS[i].reply_flag != 0)
                v |= 1;
        } while (i--);
        serial_buf[11] = (char)(v + 0x30);
        {
            uint8_t f5 = SLOTS[5].reply_flag;
            __asm__ volatile("" : "+r"(f5));
            v = (uint8_t)(f5 != 0);
        }
        v = (uint8_t)(v << 1);
        if (SLOTS[4].reply_flag != 0)
            v |= 1;
        serial_buf[12] = (char)(v + 0x30);
        serial_buf[13] = (char)(cfg_car_count + 0x30);
        serial_buf[14] = (char)((status_byte_219 & 0x0F) + 0x30);
        serial_buf[15] = (char)(((status_byte_219 >> 4) & 0x0F) + 0x30);
        serial_buf[16] = 0;
        serial_buf[17] = '$';
        reply_append_checksum((char *)serial_buf);
    } else {
        __asm__ volatile("" ::: "memory");
        serial_buf[0] = (char)(((ev[0] + 1) & 0x0F) + 0x30);
        serial_buf[1] = (char)((ev[4] & 0x0F) + 0x30);
        serial_buf[2] = (char)(((ev[4] >> 4) & 0x0F) + 0x30);
        serial_buf[3] = (char)((ev[3] & 0x0F) + 0x30);
        serial_buf[4] = (char)(((ev[3] >> 4) & 0x0F) + 0x30);
        serial_buf[5] = (char)((ev[2] & 0x0F) + 0x30);
        serial_buf[6] = (char)(((ev[2] >> 4) & 0x0F) + 0x30);
        serial_buf[7] = (char)((ev[1] & 0x0F) + 0x30);
        serial_buf[8] = (char)(((ev[1] >> 4) & 0x0F) + 0x30);
        serial_buf[9] = (char)(ev[5] + 0x31);
        serial_buf[10] = 0;
        serial_buf[11] = '$';
        reply_append_checksum((char *)serial_buf);

        {
            ev = event_ring_rd;
            ev[0] = 8;
            if (ev == &event_ring[42])          /* last entry: wrap to the first */
                event_ring_rd = event_ring;
            else
                event_ring_rd = ev + 6;
        }
    }
    serial_ptr = serial_buf;
}

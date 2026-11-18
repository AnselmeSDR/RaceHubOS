/* bot_mode.c — BOT mode for the Carrera Control Unit (hardware 5, patched V339 firmware).
 * Corrected version (review of 10/10): joystick word format read from the firmware.
 *
 * Commands (letter 'B', format ` + letter + ASCII params + '$'):
 *   `B<adr><gaz>$   throttle 0-15 in one character ('0'..'9' = 0..9, ':'..'?' = 10..15),
 *                   'A' = return the slot to the physical joystick
 *   `B<adr>L$       track switch one-shot: SW "pressed" for ONE transmission of the word
 *
 * ---- The joystick word (what the hook receives and returns) ----
 * Built by FUN_code_03aa (0x0754) from the structure 0x21C+16·id
 * (Z+0 = throttle, Z+1 = SW), then sent bit 0 FIRST by isr_TIMER1_COMPB:
 *
 *     bit   8    7   6   5   4    3    2   1   0
 *          TA   G0  G1  G2  G3   SW   R0  R1  R2      (9 bits, Z+6 = 9)
 *
 * i.e. on the rails "1 R2 R1 R0 SW G3 G2 G1 G0 TA" (slotbaer, Reglerdatenwort):
 *   - bits 0-2: car address, DO NOT TOUCH;
 *   - bit 3   : SW, active low (0 = switch key pressed, 1 = rest);
 *   - bits 4-7: throttle, bits in reverse order (bit 4 = G3 = most significant);
 *   - bit 8   : TA (fuel mode), handled by the CU.
 *
 * ---- Word identifiers (WORD_INDEX = 0x01BA) ----
 * logique_course replaces 0x01BA with table[0x0062 + id] ('next word' list
 * copied from flash at reset): the emitted cycle is 0,4,1,5,2,8,3,6,7,9 =
 * joysticks 0..5, 6 = programming, 7 = pace car, 8 = active, 9 = active/acknowledge.
 * Only ids 0..5 are joystick words: 8 and 9 are NOT joysticks 6-7.
 */
#include <stdint.h>

#define WORD_INDEX   (*(volatile uint8_t *)0x01BA)  /* id of the word being built */
#define CMD_PARAM1   (*(volatile uint8_t *)0x011D)  /* command parameters */
#define CMD_PARAM2   (*(volatile uint8_t *)0x011E)

/* BOT state — free RAM above the firmware's .bss (0x006C-0x0416) and below the stack
 * (SP starts at 0x045F; worst-case stack depth of the firmware: 40 bytes, see
 * firmware/bot/README.md). firmware/build.py extends crt0's .bss clear loop to 0x0425,
 * so this state is 0 at reset.
 * ⚠️ bot.3 and bot.4 kept it in bytes [2],[3] of the slot structs: the full
 * reconstruction shows they are firmware state (+2 status: tank level / empty bit,
 * +3 press_edge, rewritten every cycle) — those images are defective. */
#define BOT_THROTTLE(i) (((volatile uint8_t *)0x0417)[i])  /* rail throttle bits, slots 0-5 */
#define BOT_TTL(i)      (((volatile uint8_t *)0x041D)[i])  /* watchdog countdown, slots 0-5 */
#define BOT_MASK        (*(volatile uint8_t *)0x0423)      /* address bit = BOT slot */
#define LANE_PENDING    (*(volatile uint8_t *)0x0424)      /* address bit = lane change armed */

enum {
    BOT_SLOTS   = 6,     /* ids 0..5 = joystick words                     */
    ADDR_BITS   = 0x07,  /* bits 0-2: address (kept as is)                */
    SW_BIT      = 0x08,  /* bit 3: switch, 0 = pressed                    */
    WATCHDOG_CYCLES = 13, /* ~1 s of rail cycles (75 ms) without a B throttle command -> throttle 0 */
};

/* throttle 0..15 -> word field: G3 in bit 4, G2 in bit 5, G1 in bit 6, G0 in bit 7 */
static uint8_t throttle_to_rail_bits(uint8_t g)
{
    uint8_t r = 0;
    if (g & 8) r |= 0x10;
    if (g & 4) r |= 0x20;
    if (g & 2) r |= 0x40;
    if (g & 1) r |= 0x80;
    return r;
}

/* ---- command `B<adr><v>$ (dispatcher, main loop) ---- */
void cmd_bot_set(void)
{
    uint8_t adr = (uint8_t)(CMD_PARAM1 - '0');
    uint8_t val = (uint8_t)(CMD_PARAM2 - '0');
    uint8_t bit;

    if (adr >= BOT_SLOTS)
        return;
    bit = (uint8_t)(1u << adr);

    if (val == 17) {                  /* 'A': return to physical joystick */
        BOT_MASK &= (uint8_t)~bit;
        LANE_PENDING &= (uint8_t)~bit;
        return;
    }
    if (val == 28) {                  /* 'L': arm the track switch        */
        if (BOT_MASK & bit)
            LANE_PENDING |= bit;
        return;                       /* refused if slot is not BOT       */
    }
    if (val > 15)                     /* unexpected character             */
        return;

    BOT_THROTTLE(adr) = throttle_to_rail_bits(val);    /* sets throttle (and activates slot) */
    BOT_TTL(adr) = WATCHDOG_CYCLES;                    /* each throttle command feeds the watchdog */
    BOT_MASK |= bit;
}

/* ---- word filter just before the shifter (builder, main loop) ----
 * Receives R25:R24, returns the word. BOT slot: bot's throttle, SW at rest (the
 * physical joystick no longer passes), address and TA unchanged; armed switch = SW at 0
 * for this single transmission. */
uint16_t bot_hook_word(uint16_t mot)
{
    uint8_t adr = WORD_INDEX;
    uint8_t bit, lo, thr;

    if (adr >= BOT_SLOTS)
        return mot;                   /* programming, pace car, active words */
    bit = (uint8_t)(1u << adr);
    if ((BOT_MASK & bit) == 0)
        return mot;                   /* slot not in BOT mode */

    /* watchdog: no throttle command for WATCHDOG_CYCLES cycles (app killed, link lost)
     * -> throttle 0; the slot stays a bot, as after `B<adr>0` */
    thr = BOT_THROTTLE(adr);
    if (BOT_TTL(adr) == 0)
        thr = 0;
    else
        BOT_TTL(adr)--;
    lo = (uint8_t)(((uint8_t)mot & ADDR_BITS) | SW_BIT | thr);
    if (LANE_PENDING & bit) {
        lo &= (uint8_t)~SW_BIT;       /* press: SW active at 0 */
        LANE_PENDING &= (uint8_t)~bit;
    }
    return (uint16_t)((mot & 0xFF00u) | lo);
}

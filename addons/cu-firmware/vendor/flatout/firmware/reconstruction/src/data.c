/* data.c — the firmware's initialised data and version string.
 * Carrera Digital CU V339 (ATmega16), avr-gcc 5.4.0+Atmel3.6.0 -Os.
 *
 * .data (12 bytes, RAM 0x0060-0x006B): crt0 copies the initial values from flash
 * (load address 0x36AC, right after the code) at reset.
 * .version (16 bytes, flash 0x37F0): the identification string; the version command
 * sends the "339" part (id339, 0x37FB).
 */
#include <stdint.h>

extern volatile uint8_t prog_buf[];     /* 0x0190 : PROG buffer (20 bytes) */

/* GCC emits these two in reverse order of definition: 0x0062 is defined first. */
/* 0x0062: next word id of the 10-word rail cycle, indexed by the current id:
 * the cycle runs 0, 4, 1, 5, 2, 8, 3, 6, 7, 9 (controllers 0-5, 6 = programming /
 * inject queue, 7 = pace car and state machine, 8-9 = status words). */
uint8_t cycle_next_table[10] = { 4, 5, 8, 6, 1, 2, 7, 9, 3, 0 };

/* 0x0060: source pointer of the EEPROM save loop (state 9). It starts at the end of
 * the 20-byte PROG buffer, so the loop has nothing to copy until state 8 rewinds it. */
uint8_t *eeprom_save_src = (uint8_t *)&prog_buf[20];

/* 0x37F0: identification string, last 16 bytes before the bootloader. */
const char version_id[16] __attribute__((section(".version"), used)) = "#BBLACKB_NF339#";

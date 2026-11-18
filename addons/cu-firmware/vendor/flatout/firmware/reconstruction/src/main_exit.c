/* recon_end.c — tail of the V339 firmware (Carrera Digital, ATmega16)
 * Batch "main + end of .text". Pinned toolchain: avr-gcc 4.8.1 -Os -mmcu=atmega16
 * (container gcc48), symbolic method (externs resolved at link, relocs masked
 * in scoring — see method.md).
 *
 * Targets (all VALIDATED at link: linked image == firmware over 0x351E..0x36AB):
 *   main      @0x351E (210 bytes)  -> rebuilt here in C (scorer 210/210)
 *   0x35F0    (40 bytes)  = __udivmodhi4  (libgcc _udivmodhi4.o)   -> match by construction
 *   0x3618    (40 bytes)  = __divmodhi4   (libgcc _divmodhi4.o)    -> match by construction
 *   0x3640    (12 bytes)  = __tablejump2__/__tablejump__ (libgcc _tablejump.o, called by
 *                       the 5 switch sites: jmp __tablejump2__)  -> by construction
 *   0x364C    (14 bytes)  = strcpy_P               (avr-libc 1.6.8)  -> by construction
 *   0x365A    (32 bytes)  = __eerd_block_m16       (eerd_block_atmega16.o)
 *   0x367A    (20 bytes)  = __eewr_block_m16       (eewr_block_atmega16.o)
 *   0x368E    (26 bytes)  = __eewr_byte_m16/__eewr_r18_m16 (eewr_byte_atmega16.o ; useful entry
 *                       __eewr_r18_m16 @0x3690 = 24 bytes)
 *   0x36A8    (4 bytes)   = minimal exit() (cli ; for(;;)); -> rebuilt here (scorer 4/4)
 */
#include <stdint.h>
#include <stddef.h>
#include <avr/io.h>
#include <avr/interrupt.h>

/* ---- symbolic globals (SRAM; addresses at link) ---- */
extern unsigned char prog_buf[];     /* 0x0190 : 20-byte buffer of the PROG frame (EEPROM) */
extern volatile uint16_t idle_timeout;    /* 0x02BC : 16-bit counter reloaded to 0x3CF0 */
extern volatile uint8_t exclusion_mask;     /* 0x0212 */
extern volatile uint16_t delay_ticks;     /* 0x0092 : period 0x0021 (Timer0) */
extern volatile uint8_t tx_bits_left;     /* 0x03DF : mode selector (0xFF = race) */
extern volatile uint8_t op_mode;     /* 0x0210 : state (2 = idle/waiting) */
extern volatile uint8_t reply_phase;     /* 0x01FD : event to process (consumed by 0x324A) */

/* ---- firmware externals (absolute symbols at link) ---- */
extern void car_table_reset(void);            /* init of the 3 35-byte blocks @0x2BE */
extern void rail_tx_init(void);            /* ADC/mux config for joysticks */
extern void lapsense_capture_arm(void);            /* arm Timer1 capture + INT1 */
extern void serial_init(void);            /* serial_init */
extern void rail_cycle_service(void);            /* rail frame / timing builder */
extern void cmd_dispatch(void);            /* command dispatcher (RXC) */
extern void ctl_pulse_decode(void);            /* joystick pulse decoder */
extern void timer2_tick_poll(void);            /* Timer2 assist (TIFR&0x40 -> +6) */
extern void rail_reply_rx_step(void);            /* joystick event state machine */
extern void rail_events_process(void);            /* secondary processing (980 bytes) */
extern void prog_buf_set_defaults(unsigned char *p); /* PROG frame builder */
extern uint8_t sum_bytes(uint8_t *p, uint8_t n);   /* 0x0B44 : checksum */

/* ---- avr-libc 1.6.8 objects (provided by link, match by construction) ----
 * eeprom.h 1.6.8: #define eeprom_read_block __eerd_block_m16 etc. */
extern void __eerd_block_m16(void *dst, const void *src, size_t n);
extern void __eewr_block_m16(const void *src, void *dst, size_t n);

/* exit @0x36A8 (4 bytes): avr-libc 1.6.8 provides cli + jmp _exit (6 bytes),
 * the firmware has its own minimal exit — separate (called by crt0). */
void exit(void) __attribute__((noreturn));
void exit(void)
{
    cli();
    for (;;)
        ;
}

void main(void)
{
    DDRA = 0x30;                     /* outputs, being defined */
    PORTA = 0;
    DDRB = 0x08;
    PORTB = 0xF7;
    DDRC = 0x8F;
    PORTC = 0x70;
    DDRD = 0xB0;
    PORTD = 0x07;
    PORTC |= 0x02;
    ACSR = 0x80;                     /* race LED? */
    car_table_reset();

    /* load PROG frame from EEPROM and verify its checksum */
    __eerd_block_m16(prog_buf, (const void *)0x08, 20);
    if (prog_buf[19] != sum_bytes((uint8_t *)prog_buf, 19)) {
        prog_buf_set_defaults(prog_buf);
        __eewr_block_m16(prog_buf, (void *)0x08, 20);
    }

    idle_timeout = 0x3CF0;
    serial_init();
    rail_tx_init();
    lapsense_capture_arm();
    TCCR2 = 3;
    sei();
    exclusion_mask = 0;
    delay_ticks = 0x0021;

    for (;;) {
        while (tx_bits_left != 0xFF) {
            ctl_pulse_decode();                /* joystick: pulse being received */
            timer2_tick_poll();
        }
        rail_cycle_service();                    /* rail frame / timing */
        timer2_tick_poll();
        cmd_dispatch();                    /* dispatch received commands */
        timer2_tick_poll();
        if (op_mode == 2)
            continue;
        while (reply_phase) {
            rail_reply_rx_step();
            timer2_tick_poll();
        }
        rail_events_process();
        timer2_tick_poll();
    }
}

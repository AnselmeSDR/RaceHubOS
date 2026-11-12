/* recon_E.c — byte-exact reconstruction of the STATE MACHINE @0x1C76 (0x1C76..0x2A4C)
 * Carrera Digital CU V339 (ATmega16), avr-gcc 5.4.0+Atmel3.6.0 -Os.
 * ============================================================================
 * Decoding: the memory layout of the case bodies forces the SOURCE ORDER of the
 * switch: 0,1,3,2,4,5,6,11,14,12,13(15),16,17,20,18,21,19,22,23,7,8,9,24,
 * 25-29,30,31,32. The observed fallthroughs (14->12, 20->18, 21->19) can only
 * exist if the source is written in this order.
 * Case 10 is absent (table entry -> default : state=4).
 * Full state semantics: see notes_E.md.
 */
#include <stdint.h>
#include <string.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>

/* ==================== GLOBALS (addresses set by linker) ==================== */
extern volatile uint8_t  sm_state;    /* 0x0218 : state machine state          */
extern volatile uint16_t delay_ticks;       /* 0x0092 : 16-bit counter               */
extern uint8_t  start_light_level;                /* 0x0071 : counter (start level)        */
extern volatile uint8_t  button_event_last;       /* 0x0072 : last event (button_event_get)          */
extern volatile uint8_t  slot_target;       /* 0x0073 : target index/char            */
extern volatile uint8_t  cmd_g_param;       /* 0x00E7 : firmware update param ('G')  */
extern volatile uint8_t  op_mode;      /* 0x0210                                */
extern volatile uint8_t  exclusion_mask;      /* 0x0212                                */
extern volatile uint8_t  unk_213;      /* 0x0213                                */
extern volatile uint8_t  ctl_edge_flags_prev;      /* 0x0214 : previous image of 0x018E     */
extern volatile uint8_t  unk_217;      /* 0x0217                                */
extern volatile uint8_t  car_arm_mask;      /* 0x01B7                                */
extern volatile uint8_t  start_window_ticks;      /* 0x01B8                                */
extern volatile uint8_t  cycle_idx;      /* 0x01BA : cycle index                  */
extern volatile uint8_t  unk_1bc;      /* 0x01BC                                */
extern volatile uint8_t  cfg_sound_enable;      /* 0x019C : telemetry queue enable       */
extern volatile uint8_t  cfg_lights_seq_a;      /* 0x019D                                */
extern volatile uint8_t  cfg_lights_seq_b;      /* 0x019E                                */
extern volatile uint8_t  cfg_slot_default;      /* 0x019F                                */
extern volatile uint8_t  cfg_car_count;      /* 0x01A0                                */
extern volatile uint8_t  cfg_keep_awake;      /* 0x01A1                                */
extern volatile uint8_t  cfg_btn_enable;      /* 0x01A2                                */
extern volatile uint8_t  prog_checksum;      /* 0x01A3                                */
extern volatile uint8_t  unk_1fe;      /* 0x01FE                                */
extern volatile uint16_t idle_timeout;      /* 0x02BC : firmware update timer/deadline */
extern volatile uint8_t  ctl_edge_flags;     /* 0x018E : rail flags (ISR)             */
extern volatile uint8_t  adc_fault_flag;      /* 0x03DB                                */
extern volatile uint8_t  seq_step;      /* 0x0400 : counter (start/update)       */
extern volatile uint8_t  frame_quote_flag;      /* 0x011C                                */
extern uint8_t *eeprom_save_src;                /* 0x0060 : SRAM pointer, EEPROM source  */
extern uint16_t eeprom_save_addr;                /* 0x006F : current EEPROM address       */
extern volatile uint16_t pd5_pulse_ticks;       /* 0x0090                                */
extern volatile uint8_t  prog_buf[];     /* 0x0190 : PROG buffer (20 bytes)       */
extern volatile uint8_t  slots[];      /* 0x021C + 16*i : slot structs          */
/* the same 16-byte slot records, as a struct (field access = std/ldd Z+n) */
typedef struct { uint8_t b[9]; uint16_t v; uint8_t f11, f12, r[3]; } slot16_t;
extern volatile slot16_t slot_tab[];   /* 0x021C (= slots) */
extern volatile uint8_t  slot_active[];    /* 0x0200 : active flags (6 bytes)       */
extern volatile uint8_t  slot7_throttle_alt;      /* 0x0290 = slots[7]+4                   */
extern volatile uint8_t  slot7_sw_alt;      /* 0x0291 = slots[7]+5                   */

/* ==================== CALLED FUNCTIONS ==================== */
void q_push(uint8_t a, uint8_t b);                     /* 0x0140 */
void inject_queue_push(uint8_t a, uint8_t b, uint8_t c);          /* 0x15F8 */
void prog_buf_set_defaults(char *p);                                  /* 0x0B5C */
uint8_t button_event_get(void);                                  /* 0x14D8 */
uint8_t ready_check(void);                                  /* 0x1C44 */
void car_table_reset(void);                                   /* 0x13DC */
void lights_chase_step(void);                                     /* 0x1A2C */
uint8_t sum_bytes(char *p, uint8_t n);                     /* 0x0B44 */
void eewr(uint16_t addr, uint8_t data);                /* 0x368E */

/* ========================================================================= */
void state_machine_run(void)
{
    uint8_t found;
    uint8_t ev;
    int i;
    uint16_t t;

    switch (sm_state) {

    /* ---- state 0: cold start (nothing to do while delay_ticks is running) ---- */
    case 0:
        if (delay_ticks != 0)
            return;
        start_window_ticks = 0x21;
        inject_queue_push(0xF3, 0x00, 0x01);
        inject_queue_push(0xF4, 0x0F, 0x01);
        sm_state = 1;
        break;

    /* ---- state 1: wait for event (buttons/update) ---- */
    case 1: {
        uint8_t *p = (uint8_t *)prog_buf;
        ev = button_event_get();
        switch (ev) {
        case 1:
            PORTA |= 0x10;
            q_push(2, 0x14);
            prog_buf_set_defaults((char *)prog_buf);
            for (i = 0; i < 6; i++) {
                inject_queue_push((i << 5), 0x0F, 2);
                t = (uint16_t)(i << 5);
                inject_queue_push((uint8_t)(t | 1), 0x0F, 2);
                inject_queue_push((uint8_t)(t | 2), 0x08, 2);
                {
                    uint16_t w = *p++;
                    w |= (uint16_t)(*p++) << 8;
                    slot_tab[i].v = w;
                }
            }
            sm_state = 8;
            break;
        case 2:
            PORTA |= 0x20;
            if (cfg_sound_enable == 0) {
                cfg_sound_enable = 1;
                q_push(2, 0x14);
            } else {
                q_push(2, 0x14);
                cfg_sound_enable = 0;
            }
            sm_state = 8;
            break;
        case 5:
            PORTA |= 0x10;
            q_push(2, 0x14);
            seq_step = 0;
            slot_target = cfg_slot_default;
            inject_queue_push(0xF4, 0x01, 0x02);
            sm_state = 2;
            break;
        case 6:
            q_push(2, 0x14);
            sm_state = 3;
            break;
        case 7:
            q_push(2, 0x14);
            PORTC |= 0x04;
            if (cfg_keep_awake == 0)
                cfg_keep_awake = 1;
            else {
                cfg_keep_awake = 0;
                q_push(0, 0x14);
                q_push(2, 0x14);
            }
            sm_state = 8;
            break;
        case 8:
            q_push(2, 0x14);
            PORTC |= 0x08;
            if (cfg_btn_enable == 0)
                cfg_btn_enable = 1;
            else {
                cfg_btn_enable = 0;
                q_push(0, 0x14);
                q_push(2, 0x14);
            }
            sm_state = 8;
            break;
        default:
            sm_state = 4;
            break;
        }
        break;
    }

    /* ---- state 3: handle event 2/6 (switching) ---- */
    case 3:
        button_event_last = button_event_get();
        if (cfg_car_count == 6)
            PORTA &= (uint8_t)~0x20;
        else
            PORTA |= 0x20;
        PORTA |= 0x10;
        ev = button_event_last;
        if (ev == 6) {
            q_push(4, 5);
            if (cfg_car_count == 6)
                cfg_car_count = 8;
            else
                cfg_car_count = ev;
        } else if (ev == 2) {
            sm_state = 8;
            q_push(4, 5);
        }
        break;

    /* ---- state 2: start-light countdown sequence ---- */
    case 2:
        ev = button_event_get();
        button_event_last = ev;
        if (ev == 5) {
            q_push(4, 5);
            seq_step++;
            if (unk_1bc != 0)
                seq_step &= 0x03;
            else
                seq_step &= 0x01;
            PORTA &= (uint8_t)~0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            switch (seq_step) {
            case 0:
                PORTA |= 0x10;
                break;
            case 1:
                PORTA |= 0x20;
                PORTA |= 0x10;
                break;
            case 2:
                PORTC |= 0x80;
                PORTA |= 0x20;
                PORTA |= 0x10;
                break;
            case 3:
                PORTC |= 0x04;
                PORTC |= 0x80;
                PORTA |= 0x20;
                PORTA |= 0x10;
                break;
            default:
                break;
            }
            inject_queue_push(0xF4, (uint8_t)(seq_step + 1), 0x02);
        } else if (ev == 2) {
            if (cfg_slot_default == slot_target)
                sm_state = 4;
            else
                sm_state = 8;
            start_window_ticks = 0x21;
            inject_queue_push(0xF4, 0x0F, 0x01);
            q_push(4, 5);
        }
        break;

    /* ---- state 4: enter firmware update mode if both inputs are present ---- */
    case 4:
        if ((PINC & 0x10) == 0)
            return;
        if ((PINC & 0x20) == 0)
            return;
        PORTA &= (uint8_t)~0x10;
        PORTA &= (uint8_t)~0x20;
        PORTC |= 0x80;
        PORTC &= (uint8_t)~0x04;
        PORTC &= (uint8_t)~0x08;
        unk_217 = 0;
        sm_state = 5;
        break;

    /* ---- state 5: firmware update / DFU + wait for rail edge ---- */
    case 5:
        if (cmd_g_param != 0) {
            if (cmd_g_param == 0x12) {
                /* restart into bootloader: EEPROM[1]=0x55 + watchdog */
                cli();
                eewr(1, 0x55);
                wdt_enable(WDTO_15MS);
                for (;;)
                    ;
            }
            idle_timeout = 0x3CF0;
            adc_fault_flag = 1;
            q_push(2, 0x19);
            q_push(4, 0x19);
            op_mode = 2;
            *(volatile uint16_t *)(slots + 7) = 0x0834;
            *(volatile uint16_t *)(slots + 14) = (uint16_t)(0xFF | ((uint16_t)(cmd_g_param << 1) << 8));
            slots[6] = 0x0E;
            cycle_idx = 0;
            unk_1fe = 1;
            delay_ticks = 0x42;
        }
        {
            if ((ctl_edge_flags_prev ^ ctl_edge_flags) & ctl_edge_flags) {
                q_push(2, 0x12);
                q_push(0, 9);
                q_push(2, 0x12);
                q_push(0, 9);
                sm_state = 6;
                start_light_level = 0;
                delay_ticks = 0;
            }
            ctl_edge_flags_prev = ctl_edge_flags;
            ev = button_event_get();
            button_event_last = ev;
            if (ev != 0)
                q_push(4, 5);
            ev = button_event_last;
            switch (ev) {
            case 1:
                sm_state = 0x17;
                delay_ticks = 0x029A;
                PORTA |= 0x20;
                return;
            case 2: {
                sm_state = 0x18;
                delay_ticks = 0x014D;
                exclusion_mask = 0xFF;
                unk_217 = 1;
                PORTA |= 0x10;
                PORTA |= 0x20;
                PORTC |= 0x80;
                PORTC |= 0x04;
                PORTC |= 0x08;
                inject_queue_push(0xF0, 5, 1);
                if (frame_quote_flag == 0) {
                    car_table_reset();
                    inject_queue_push(6, 9, 1);
                }
                if (ready_check() == 0)
                    return;
                for (i = 0; i < 6; i++) {
                    inject_queue_push((i << 5) | 0x0A, 7, 1);
                    inject_queue_push((i << 5) | 0x05, 1, 1);
                    slot_tab[i].v = ((volatile uint16_t *)prog_buf)[i];
                    slot_tab[i].f11 = 0x0E;
                    slot_tab[i].b[2] = 7;
                }
                return;
            }
            case 5:
            case 6:
            case 7:
                goto s5_ev567;
            case 8:
                goto s5_ev8;
            default:
                return;
            }

        s5_ev567:
            if (cfg_btn_enable == 0)
                return;
            slot_target = (uint8_t)(ev - 5);
            PORTA |= 0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
            sm_state = 7;
            switch (slot_target) {
            case 0:
                seq_step = cfg_lights_seq_a;
                break;
            case 1:
                seq_step = cfg_lights_seq_b;
                break;
            case 2: {
                uint16_t q;
                q = (uint16_t)(*(volatile uint16_t *)prog_buf / 0x07C4);
                seq_step = (uint8_t)(q - 2);
                break;
            }
            default:
                break;
            }
            PORTC &= (uint8_t)~0x80;
            switch (seq_step) {     /* light up one more lamp per pair of steps */
            case 8:
            case 9:
                PORTC |= 0x08;
                /* fallthrough */
            case 6:
            case 7:
                PORTC |= 0x04;
                /* fallthrough */
            case 4:
            case 5:
                PORTC |= 0x80;
                /* fallthrough */
            case 2:
            case 3:
                PORTA |= 0x20;
                /* fallthrough */
            case 0:
            case 1:
                break;
            default:
                return;
            }
            PORTA |= 0x10;
            return;

        s5_ev8:
            if (cfg_btn_enable == 0)
                return;
            PORTA |= 0x10;
            PORTC &= (uint8_t)~0x80;
            unk_217 = 1;
            sm_state = 11;
            seq_step = 1;
            for (i = 0; i < 6; i++) {
                slot_tab[i].b[4] = 0;
                slot_tab[i].b[5] = 1;
            }
            slot_tab[7].b[4] = 0;
            slot_tab[7].b[5] = 1;
            return;
        }

    /* ---- state 6: phase 2 of start lights (3 groups by start_light_level) ---- */
    case 6:
        if (delay_ticks != 0)
            return;
        delay_ticks = 5;
        switch (start_light_level) {
        case 0:
        case 3:
        case 6:
            PORTA &= (uint8_t)~0x10;
            PORTA |= 0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC |= 0x04;
            PORTC &= (uint8_t)~0x08;
            break;
        case 1:
        case 4:
        case 7:
            PORTA |= 0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC |= 0x08;
            break;
        case 2:
        case 5:
        case 8:
            PORTA &= (uint8_t)~0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC |= 0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
            break;
        default:
            break;
        }
        start_light_level++;
        if (start_light_level == 9)
            sm_state = 4;
        break;

    /* ---- state 11: choose first free slot ---- */
    case 11:
        ev = button_event_get();
        button_event_last = ev;
        switch (ev) {
        case 1:
            sm_state = 4;
            q_push(4, 5);
            break;
        case 8:
            if (seq_step < 3) {
                seq_step++;
                if (seq_step == 2)
                    PORTA |= 0x20;
                if (seq_step == 3)
                    PORTC |= 0x80;
            } else {
                seq_step = 1;
                PORTC &= (uint8_t)~0x80;
                PORTA &= (uint8_t)~0x20;
                PORTA |= 0x10;
            }
            q_push(4, 5);
            break;
        }
        {
            /* the single slot that is free (b[1] == 0) and idle (b[0] == 0), else 0xFF */
            found = 0xFF;
            for (i = 0; i < 6; i++) {
                if (slot_tab[i].b[1] == 0) {
                    /* the empty asm keeps the 0xFF arm a real block: without it GCC splits
                     * the edge and places this arm after the (uint8_t)i arm (see method.md) */
                    if (found != 0xFF) {
                        found = 0xFF;
                        __asm__ __volatile__("");
                    } else
                        found = (uint8_t)i;
                }
                if (slot_tab[i].b[0] != 0)
                    found = 0xFF;
            }
            slot_target = found;
            if (found == 0xFF)
                return;
            q_push(2, 0x14);
            sm_state = 12;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
        }
        break;

    /* ---- states 14/12/13/15: enable/disable slot (slot_target) ---- */
    case 14:
        PORTA |= 0x20;
        /* fallthrough */
    case 12:
        PORTA |= 0x10;
        slot_tab[slot_target].b[5] = 0;
        sm_state++;
        break;
    case 13:
    case 15:
        slot_tab[slot_target].b[5] = 1;
        sm_state++;
        break;

    /* ---- states 16/17: arming (delay_ticks=0x21) ---- */
    case 16:
        adc_fault_flag = 1;
        delay_ticks = 0x21;
        sm_state++;
        break;
    case 17:
        if (delay_ticks != 0)
            return;
        PORTC |= 0x80;
        adc_fault_flag = 0;
        delay_ticks = 0x21;
        sm_state++;
        break;

    /* ---- states 20/18: slot run end ---- */
    case 20:
        PORTC |= 0x04;
        /* fallthrough */
    case 18:
        PORTC |= 0x80;
        if (delay_ticks != 0)
            return;
        slot_tab[slot_target].b[5] = 0;
        sm_state++;
        break;

    /* ---- states 21/19: slot run start ---- */
    case 21:
        delay_ticks = 0x21;
        /* fallthrough */
    case 19:
        slot_tab[slot_target].b[5] = 1;
        sm_state++;
        break;

    /* ---- state 22: wait for end of countdown ---- */
    case 22:
        if (delay_ticks != 0)
            return;
        seq_step--;
        if (seq_step == 0) {
            sm_state = 4;
            break;
        }
        PORTC |= 0x08;
        delay_ticks = 0;
        sm_state = 0x12;
        break;

    /* ---- state 23: wait T before restarting ---- */
    case 23:
        if (button_event_get() == 1) {
            q_push(4, 5);
            sm_state = 4;
        }
        break;

    /* ---- state 7: T4 start-light cycle + slot configuration ---- */
    case 7: {
        uint8_t *p = (uint8_t *)prog_buf;
        start_light_level++;
        /* even step: its light blinks (on at odd ticks); odd step: its light is steady on */
        switch (seq_step) {
        case 0:            /* even step: blink */
            if ((int8_t)(start_light_level << 7) >= 0) {
                PORTA &= (uint8_t)~0x10;
                break;
            }
            /* fallthrough */
        case 1:            /* odd step: steady on */
            PORTA |= 0x10;
            break;
        case 2:            /* even step: blink */
            if ((int8_t)(start_light_level << 7) >= 0) {
                PORTA &= (uint8_t)~0x20;
                break;
            }
            /* fallthrough */
        case 3:            /* odd step: steady on */
            PORTA |= 0x20;
            break;
        case 4:            /* even step: blink */
            if ((int8_t)(start_light_level << 7) >= 0) {
                PORTC &= (uint8_t)~0x80;
                break;
            }
            /* fallthrough */
        case 5:            /* odd step: steady on */
            PORTC |= 0x80;
            break;
        case 6:            /* even step: blink */
            if ((int8_t)(start_light_level << 7) >= 0) {
                PORTC &= (uint8_t)~0x04;
                break;
            }
            /* fallthrough */
        case 7:            /* odd step: steady on */
            PORTC |= 0x04;
            break;
        case 8:            /* even step: blink */
            if ((int8_t)(start_light_level << 7) >= 0) {
                PORTC &= (uint8_t)~0x08;
                break;
            }
            /* fallthrough */
        case 9:            /* odd step: steady on */
            PORTC |= 0x08;
            break;
        default:
            seq_step = 0;
            PORTA &= (uint8_t)~0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
            break;
        }
        ev = button_event_get();
        button_event_last = ev;
        switch (ev) {
        case 1:
            sm_state = 4;
            q_push(4, 5);
            break;
        case 2: {
            uint8_t s = slot_target;
            if (s == 0) {
                cfg_lights_seq_a = seq_step;
                switch (seq_step) {
                case 0:
                    seq_step = 0x01;
                    break;
                case 1:
                    seq_step = 0x02;
                    break;
                case 2:
                    seq_step = 0x03;
                    break;
                case 3:
                    seq_step = 0x05;
                    break;
                case 4:
                    seq_step = 0x06;
                    break;
                case 5:
                    seq_step = 0x07;
                    break;
                case 6:
                    seq_step = 0x09;
                    break;
                case 7:
                    seq_step = 0x0B;
                    break;
                case 8:
                    seq_step = 0x0D;
                    break;
                case 9:
                    seq_step = 0x0F;
                    break;
                }
            } else if (s == 1) {
                cfg_lights_seq_b = seq_step;
                seq_step += 6;
            } else if (s == 2) {
                seq_step += 2;
                for (i = 0; i < 6; i++) {
                    uint16_t w = (uint16_t)(seq_step * 0x07C4);
                    ((uint16_t *)prog_buf)[i] = w;
                    slot_tab[i].v = w;
                }
            }
            q_push(2, 0x14);
            inject_queue_push(s = slot_target, seq_step, 2);
            inject_queue_push((uint8_t)(s | 0x20), seq_step, 2);
            inject_queue_push((uint8_t)(s | 0x40), seq_step, 2);
            inject_queue_push((uint8_t)(s | 0x60), seq_step, 2);
            inject_queue_push((uint8_t)(s | 0x80), seq_step, 2);
            inject_queue_push((uint8_t)(s | 0xA0), seq_step, 2);
            sm_state = 8;
            PORTA |= 0x10;
            break;
        }
        case 5:
        case 6:
        case 7:
            if (slot_target == ev - 5) {
                seq_step++;
                q_push(4, 5);
            }
            break;
        }
        (void)p;
        break;
    }

    /* ---- state 8: EEPROM save (preparation) ---- */
    case 8:
        if ((PINC & 0x10) == 0)
            return;
        if ((PINC & 0x20) == 0)
            return;
        eeprom_save_src = (uint8_t *)0x0190;
        eeprom_save_addr = 8;
        prog_checksum = sum_bytes((char *)prog_buf, 19);
        sm_state = 9;
        break;

    /* ---- state 9: EEPROM save (write loop) ---- */
    case 9:
        if (eeprom_save_src < (uint8_t *)&prog_buf[20]) {   /* end of the 20-byte PROG buffer */
            eewr(eeprom_save_addr, *eeprom_save_src);
            eeprom_save_src++;
            eeprom_save_addr++;
            lights_chase_step();
        } else
            sm_state = 4;
        break;

    /* ---- state 24: prepare starting grid ---- */
    case 24: {
        uint8_t type, ratio;
        ev = button_event_get();
        button_event_last = ev;
        if (ev == 2) {
            sm_state = 0x19;
            delay_ticks = 0x42;
            q_push(2, 0x19);
            memset((void *)slot_active, 0, 6);
            inject_queue_push(0xF0, 1, 1);
            for (i = 0; i < 6; i++)
                inject_queue_push((i << 5) | 5, 0, 1);
            PORTA |= 0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
        }
        if (button_event_last == 1) {
            q_push(2, 0x19);
            exclusion_mask = 0;
            sm_state = 4;
            inject_queue_push(0xF0, 0, 1);
            for (i = 0; i < 6; i++)
                inject_queue_push((i << 5) | 5, 0, 1);
        }
        if (ready_check() == 0)
            return;
        {
            for (i = 0; i < 6; i++) {
                slot_tab[i].f12 = 0;
                if (slot_tab[i].b[3] != 0) {
                    type = slot_tab[i].f11;
                    if ((type & (uint8_t)~0x02) == 0)
                        type = 14;
                    else
                        type -= 2;
                    ratio = (uint8_t)(type >> 1);
                    inject_queue_push((i << 5) | 0x0A, ratio, 1);
                    slot_tab[i].v = type * (((volatile uint16_t *)prog_buf)[i] / 14) - 1;
                    slot_tab[i].f11 = type;
                    slot_tab[i].b[3] = 0;
                    slot_tab[i].b[2] = ratio;
                }
            }
        }
        break;
    }

    /* ---- states 25-29: search for active slot -> state 31 ---- */
    case 25:
    case 26:
    case 27:
    case 28:
    case 29:
        for (i = 0; i < 6; i++) {
            if (slot_tab[i].b[0] != 0) {
                inject_queue_push(0xF0, 0, 1);
                slot_active[i] = 1;
                sm_state = 0x1F;
                delay_ticks = 0x3F;
                q_push(2, 0x0C);
                q_push(0, 0x0C);
                q_push(4, 0x0C);
                break;
            }
        }
        if (delay_ticks != 0)
            return;
        sm_state++;
        delay_ticks = 0x42;
        if (sm_state == 0x1E) {
            exclusion_mask = 0;
            car_arm_mask = 0;
            unk_217 = 0;
            unk_213 = 0;
            q_push(4, 0x0C);
            inject_queue_push(0xF0, 0, 1);
            if (PINB & 0x02)
                PORTD |= 0x20;
            pd5_pulse_ticks = 10;
        } else {
            q_push(2, 0x19);
            switch (sm_state) {
            case 0x1A:
                PORTA |= 0x20;
                break;
            case 0x1B:
                PORTC |= 0x80;
                break;
            case 0x1C:
                PORTC |= 0x04;
                break;
            case 0x1D:
                PORTC |= 0x08;
                break;
            default:
                break;
            }
            inject_queue_push(0xF0, (uint8_t)(sm_state - 0x18), 1);
        }
        break;

    /* ---- state 30: reset lights ---- */
    case 30:
        PORTA &= (uint8_t)~0x10;
        PORTA &= (uint8_t)~0x20;
        PORTC |= 0x80;
        PORTC &= (uint8_t)~0x04;
        PORTC &= (uint8_t)~0x08;
        if (delay_ticks == 0)
            sm_state = 4;
        break;

    /* ---- state 31: lock/unlock grid ---- */
    case 31:
        slots[4] = 0;
        slots[20] = 0;
        slots[36] = 0;
        slots[52] = 0;
        slots[68] = 0;
        slots[84] = 0;
        if (delay_ticks & 1) {
            if (!(PORTA & 0x10))
                inject_queue_push(0xF0, 5, 1);
            PORTA |= 0x10;
            PORTA |= 0x20;
            PORTC |= 0x80;
            PORTC |= 0x04;
            PORTC |= 0x08;
        } else {
            if (PORTA & 0x10)
                inject_queue_push(0xF0, 0, 1);
            PORTA &= (uint8_t)~0x10;
            PORTA &= (uint8_t)~0x20;
            PORTC &= (uint8_t)~0x80;
            PORTC &= (uint8_t)~0x04;
            PORTC &= (uint8_t)~0x08;
        }
        if (delay_ticks != 0)
            return;
        sm_state = 0x20;
        delay_ticks = 7;
        for (i = 0; i < 6; i++) {
            if (slot_active[i] != 0) {
                slot_tab[i].b[4] = 3;
                slot_tab[i].b[2] |= 0x08;
                inject_queue_push((uint8_t)((i << 5) | 0x0B), 1, 1);
            }
        }
        break;

    /* ---- state 32: resume/cancel grid ---- */
    case 32: {
        uint8_t k;
        for (k = 0; k < 6; k++) {
            if (slot_active[k] == 0)
                continue;
            if (delay_ticks & 1) {
                switch (k) {        /* light of this slot */
                case 0:
                    PORTA |= 0x10;
                    break;
                case 1:
                    PORTA |= 0x20;
                    break;
                case 2:
                    PORTC |= 0x04;
                    break;
                case 3:
                    PORTC |= 0x08;
                    break;
                default:
                    PORTC |= 0x80;
                    break;
                }
            } else {
                slot_tab[k].b[4] = 0;
                PORTA &= (uint8_t)~0x10;
                PORTA &= (uint8_t)~0x20;
                PORTC &= (uint8_t)~0x04;
                PORTC &= (uint8_t)~0x08;
                PORTC &= (uint8_t)~0x80;
            }
        }
        if (delay_ticks == 0)
            delay_ticks = 0x0F;
        if (button_event_get() == 2) {
            sm_state = 0x18;
            PORTA |= 0x10;
            PORTA |= 0x20;
            PORTC |= 0x80;
            PORTC |= 0x04;
            PORTC |= 0x08;
            inject_queue_push(0xF0, 5, 1);
            for (i = 0; i < 6; i++) {
                if (slot_active[i] != 0)
                    slot_tab[i].b[2] &= (uint8_t)~0x08;
                if (ready_check() != 0)
                    inject_queue_push((uint8_t)((i << 5) | 0x05), 1, 1);
            }
        }
        break;
    }

    default:
        sm_state = 4;
        break;
    }
}

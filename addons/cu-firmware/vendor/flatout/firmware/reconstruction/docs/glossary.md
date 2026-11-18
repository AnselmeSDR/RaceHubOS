# V339 reconstruction: renaming glossary — **APPLIED 2026-10-11**

Applied to `reconstruction/src/*.c` (1344 identifiers) and `bot/bot_mode.c` by
`reconstruction/apply_glossary.py` (re-runnable, `--dry` supported).
**Proof the byte-exactness survived:** all sources recompiled with the pinned
toolchain; 10/10 functions still byte-identical to the firmware (main, exit,
serial_rx_isr, ctl_pulse_window_isr, ctl_pulse0/2_isr, timer2_tick_service,
reply_append_checksum, slot_word_compose, cmd_dispatch), plus the bot rebuild
produces the same image SHA (see manifest).

Carrera Digital 124 Control Unit, firmware V339, ATmega16. The sources use
address-derived or ad hoc names (`FUN_code_xxxx`, `f_xxxx`, `var_xxx`, `w_xxx`,
`b_xxx`, `rN`, `sN`) and the same RAM byte often has 2-4 different names across
files. This table proposes one readable name per function, global and file.

Inputs: `SUIVI-fonctions.tsv` (61 rows), `notes-firmware-V339.md`, `SOURCES/*.c`,
`BOT/bot_mode.c`. Evidence below is from comments and code in those files only.

## Naming convention

- snake_case, valid C identifiers, unique across the whole project.
- Functions: `<subsystem>_<object>_<verb>`, ISRs end with `_isr`
  (`rail_tx_shift_isr`), serial commands are `cmd_<noun>_<verb>` (`cmd_status_send`).
- Data: nouns (`event_ring`, `tx_shift_reg`, `slot[i].throttle`, `car[i].best_lap`).
- Prefixes: `serial_`, `cmd_`, `rail_` (rail TX/RX), `ctl_` (controller / manette),
  `lapsense_` (lap detection inputs), `timer2_`, `adc_`, `beep_`/`buzzer_`,
  `inject_queue_`, `event_ring_`, `slot_`, `car_`, `rank_`, `buttons_`, `lights_`,
  `prog_`, `cfg_` (bytes persisted in the PROG frame), `stream_`/`update_` (low confidence).
- Addresses stay in a trailing comment (`/* 0x01BA */`), never in the name.
  Only names in "Open questions" use an `unk_` placeholder.
- Struct fields are written `slot[i].field`; they are fields, not standalone globals.
- Confidence: high = role confirmed by byte-exact match or decoded behavior;
  med = consistent with code but role partly inferred; low = weak or contradictory evidence.
- Not renamed (libc/crt, standard names kept): `__init` @0x00E4, `__udivmodhi4` @0x35F0,
  `__divmodhi4` @0x3618, `__tablejump2__` @0x3640, `strcpy_P` @0x364C,
  `__eerd_block_m16` @0x365A, `__eewr_block_m16` @0x367A, `__eewr_r18_m16` @0x3690.
  Note SUIVI wrongly calls 0x3618 `strcpy_flash` and 0x364C `strcpy_flash2`.

## 1. Functions

Current-name cells list every alias found (SUIVI, `FUN_code_xxxx` word address, source files).

| Address | Current name(s) | Proposed name | Conf. | Evidence |
|---|---|---|---|---|
| 0x0122 | `FUN_code_0091`, `set_timer2` | `buzzer_set_mode` | med | TCCR2 CTC-toggle modes; PD7=OC2; fed by beep queue |
| 0x0140 | `FUN_code_00a0`, `f0140`, `f_0140`, `f_140`, `f140`, `q_push` | `beep_queue_push` | med | queue 32x2 @0x94; calls set_timer2; gated by 0x019C |
| 0x01A6 | `FUN_code_00d3`, `f01a6`, `f_01a6`, `f01a6_i/_p/_lt` | `event_ring_reset` | high | sets ring[i].car=8 x8; both pointers = 0xE9 |
| 0x01CE | `FUN_code_00e7`, `f_01ce` | `serial_init` | med | SUIVI note "init_serial"; no source file to confirm |
| 0x01EA | `FUN_code_00f5`, `envoyer_buffer`, `f01ea`, `r2a`-`r2d` | `reply_append_checksum` | high | sums to '$', stores (sum&0xF)+'0'; sends nothing |
| 0x0202 | `FUN_code_0101`, `cmd_version`, `tsym_V` | `cmd_version_send` | high | reply '5' + "339" (flash 0x37FB) + '$' |
| 0x0232 | `FUN_code_0119`, `cmd_exclusion`, `tsym_X`, `tsym_Xv` | `cmd_exclusion_set` | high | writes 0x0212 = lo + hi*16 from serial_buf |
| 0x024A | `FUN_code_0125`, `cmd_reset_chrono`, `r6`, `f_24a` | `cmd_timer_reset` | high | '=' bits 0/3 call car_table_reset+event_ring_reset; bit1 rank_mode |
| 0x028C | `FUN_code_0146`, `cmd_J_programmer`, `cmd_J`, `f_28c` | `cmd_prog_car` | high | 'J': 2-char parse, prog_ticks table, slot+9, state 8 |
| 0x033A | `FUN_code_019d`, `cmd_T_bouton`, `cmd_T`, `r1_cmd_T` | `cmd_button_set` | high | button_cmd = serial_buf[0] - '0' |
| 0x0346 | `FUN_code_01a3`, `cmd_C`, `tsym_C`, `cva`-`cvd` | `cmd_ctl_table_set` | med | copies 6 (digit,flag) pairs to table 0xDD; 0x17D=0x3C |
| 0x0374 | `FUN_code_01ba`, `cmd_status_timing`, `cmd_status`, `f_374` | `cmd_status_send` | high | '?': event-ring record or ':' race-state frame |
| 0x0540 | `FUN_code_02a0`, `cmd_I`, `tsym_I` | `cmd_i_send` | med | constant reply 'I' + checksum + '$'; purpose unknown |
| 0x0566 | `isr_USART_RXC`, `isr_rxc` | `serial_rx_isr` | high | RX state machine: letter, params, '$' |
| 0x064C | `isr_USART_UDRE`, `isr_udre` | `serial_tx_isr` | high | drains *serial_ptr to UDR until '#' or '$' |
| 0x06A8 | `FUN_code_0354`, `dispatcher_commandes`, `disp_r`, `f_06a8` | `cmd_dispatch` | high | switch on serial_state 6/7 maps letter to handler |
| 0x0754 | `FUN_code_03aa`, `comp`, `f_754` | `slot_word_compose` | high | builds 9-bit word into slot+14; decoded bit by bit |
| 0x081A | `isr_TIMER0_COMP`, `isr_t0` | `ctl_pulse_window_isr` | med | window countdown; INTF0/INTF2 filters; re-arms INT0/INT2 |
| 0x091C | `isr_INT0`, `isr_int0` | `ctl_pulse0_isr` | med | PD2 pulse timing, shifts bits into 0x0189 |
| 0x09CC | `isr_INT2`, `isr_int2` | `ctl_pulse2_isr` | med | same on PB2; toggles ISC2 each edge |
| 0x0A8E | `FUN_code_0547`, `decoder_impulsion_manette`, `f0a8e`, `f_0a8e` | `ctl_pulse_decode` | med | at 9/10 bits stores byte in table 0x0180[addr] |
| 0x0B02 | `FUN_code_0581`, `r7`, `f_b02` | `ctl_window_start` | med | Timer0 CTC restart, window=0xA0, clears INT flags |
| 0x0B44 | `FUN_code_05a2`, `somme`, `f0b44`, `r4`, `r4a`-`r4d`, `s1`-`s6` | `sum_bytes` | high | 8-bit sum of n bytes; PROG checksum |
| 0x0B5C | `FUN_code_05ae`, `f_0b5c`, `f_05ae`, `r8a`, `r8b` | `prog_buf_set_defaults` | high | writes default 20-byte PROG frame, checksum at p[19] |
| 0x0BA2 | `isr_TIMER1_CAPT`, `isr_capt` | `lapsense_a_isr` | med | ICP1/PD6 period; tick uses result as car index |
| 0x0C08 | `isr_INT1`, `isr_int1` | `lapsense_b_isr` | med | INT1/PD3, same measurement as capture A |
| 0x0C6E | `FUN_code_0637`, `fonc_C`, `f_0c6e` | `timer2_tick_service` | high | clock32++, RX timeout, lap snapshots into car[] |
| 0x0EA2 | `FUN_code_0751`, `r3`, `f_0ea2` | `timer2_tick_poll` | high | TOV2 set: clear, TCNT2+=6, tail-call tick |
| 0x0EB8 | `FUN_code_075c`, `f_0eb8` | `rail_events_process` | med | 3-phase task: ring log, rank update, position words |
| 0x128C | `FUN_code_0946`, `r5`, `f_128c` | `lapsense_capture_arm` | high | ICES1, clear ICF1, enable ICP1 and INT1 |
| 0x12AE | `FUN_code_0957`, `trk_rank_a`, `f_12ae` | `rank_compute_a` | med | writes car.rank from laps/times; used when rank_mode=0 |
| 0x1344 | `FUN_code_09a2`, `trk_rank_b`, `f_1344` | `rank_compute_b` | med | same shape as a; used when rank_mode=1 |
| 0x13DC | `FUN_code_09ee`, `trk_init`, `f_13dc` | `car_table_reset` | high | inits 8x35 B car structs: rank 8, best 86400000 |
| 0x144C | `FUN_code_0a26`, `lire_boutons` | `buttons_scan` | high | strobes PORTC0, reads PINC4-6/PINB0, returns code 1-8 |
| 0x14D8 | `f_14d8` (not in SUIVI) | `button_event_get` | low | state machine switches on its 1,2,5,6,7 results |
| 0x1524 | `FUN_code_0a92`, `f1524`, `f_0a92` | `rail_reply_bit_read` | med | 9 ADC samples vs 0x33, majority bit, TX output off |
| 0x155C | `FUN_code_0aae`, `f155c`, `f_155c` | `power_down_or_blink` | med | no fault: all ports off + sleep; else blink PORTC7 |
| 0x15F8 | `FUN_code_0afc`, `file_mots_manette`, `f15f8`, `f_0afc`, `f_15f8` | `inject_queue_push` | high | 32 x u16 @0x1BD, head 0x1BB, repeats @0x3E0 |
| 0x162C | `FUN_code_0b16`, `lire_pots_adc`, `f162c`, `f_162c` | `adc_sample_channels` | med | reads mux, ch6, ch7 into adc_raw; range check sets fault |
| 0x16F2 | `FUN_code_0b79`, `f16f2` | `adc_to_throttle_level` | low | (ADC-0x1E) clamped, >>4 gives 0..15; no caller found |
| 0x1728 | `FUN_code_0b94`, `f1728`, `f_1728` | `timers_update` | med | decrements countdowns, beep queue, start-light pattern pins |
| 0x18C0 | `FUN_code_0c60`, `f18c0` | `hex_parse` | high | parses n ASCII hex digits into u16 |
| 0x18F2 | `FUN_code_0c79`, `f18f2` | `update_frame_decode` | low | 4-hex groups minus running key, /0xC5, checksum or hang |
| 0x1A2C | `FUN_code_0d16`, `f1a2c`, `f_0d16` | `lights_chase_step` | med | one step PORTA4, A5, C7, C2, C3 per call |
| 0x1A5C | `FUN_code_0d2e`, `f1a5c`, `f_1a5c` | `update_stream_step` | low | op_mode 2 path; pushes words to shifter; calls fnptr |
| 0x1C76 | `f_sm` (no SUIVI row) | `state_machine_run` | high | switch(0x0218) 33 states via jump table T1 |
| 0x2A4E | `FUN_code_1527`, `logique_course`, `f_2a4e` | `word_cycle_step` | low | cycle_idx = table62[cycle_idx]; reads table 0xDD |
| 0x2F8A | `FUN_code_17c5`, `builder_trame_rails`, `f_2f8a` | `rail_cycle_service` | med | per-cycle scheduler; loads shifter, period from slot[cycle] |
| 0x309A | `isr_TIMER1_COMPB`, `isr_t1c` | `rail_tx_shift_isr` | high | shifts 0x03D6 right per interrupt; reloads at 0 bits |
| 0x3146 | `FUN_code_18a3`, `f_3146` | `slots_init` | high | slots 0..9: period 6600, prog value, compose word |
| 0x31F8 | `FUN_code_18fc`, `f_31f8` | `rail_tx_init` | high | slots_init + Timer1 setup, TIFR=8, OCR1A=100 |
| 0x324A | `FUN_code_1925`, `f_324a` | `rail_reply_rx_step` | low | switch(0x01FD) 1..15 TCNT1 windows, bits to 0x0215 |
| 0x351E | `FUN_code_1a8f`, `main` | `main` | high | keep (init then main loop) |
| 0x36A8 | `exit` | `exit` | high | keep (cli; for(;;)) |
| macro | `ISR_NED` | `ISR_NAMED` | high | expands avr-libc ISR attributes with a chosen name |
| BOT | `gaz_rails` | `throttle_to_rail_bits` | high | maps 4-bit throttle to word bits 4-7 reversed |
| BOT | `cmd_B` | `cmd_bot_set` | high | 'B' command: address, throttle, 'A' release, 'L' lane |
| matching variants | `cva`-`cvd`, `r2a`-`r2d`, `r4a`-`r4d`, `s1`-`s6`, `tsym_*` | `<canonical>_v1`, `_v2`, ... | high | code-shape experiments, one per canonical function |

`bot_hook_word` (BOT/bot_mode.c) is already readable and stays.

## 2. Globals / RAM

Same byte, several current names: all aliases are listed. `slot`, `car` and
`event_ring` are arrays of structs, fields are listed per row.

| Address | Current name(s) | Proposed name | Conf. | Evidence |
|---|---|---|---|---|
| 0x0060 | `ptr_60` | `eeprom_save_src` | med | SRAM source pointer of the EEPROM save loop |
| 0x0062 | (literal `0x62+i`, x10, .data) | `cycle_next_table[10]` | high | 0,4,1,5,2,8,3,6,7,9 confirmed in code |
| 0x006C | `rr_6c` | `rails_rr_idx` | high | round-robin car counter, `& 7` |
| 0x006D | `st_6d` | `rails_phase` | high | rails task phase 0/1/2 |
| 0x006F | `ptr_6f` | `eeprom_save_addr` | med | current EEPROM address in state 9 |
| 0x0071 | `var_71` | `start_light_level` | low | comment "compteur (niveau depart)" |
| 0x0072 | `var_72` | `button_event_last` | med | stores last f_14d8 result |
| 0x0073 | `var_73` | `slot_target` | med | comment "index/car cible"; slot enable states |
| 0x008D | `cnt_8d` | `timers_div4` | med | ++ ==4 then calls timers_update |
| 0x0090 | `w_90`, `var_90` | `pd5_pulse_ticks` | low | counts down, then PORTD5 cleared; set 10 at grid reset |
| 0x0092 | `var_92`, `w_92` | `delay_ticks` | med | 16-bit countdown; 0x21 at boot, 0x42 in grid |
| 0x0094 | (queue, 0x40 B) | `beep_queue[32][2]` | med | entries (tone, duration) pushed by beep_queue_push |
| 0x00D4 | `b_d4` | `beep_q_rd` | med | read index in timers_update |
| 0x00D5 | `v_d5`, `b_d5` | `beep_q_wr` | med | write index, mod 32 |
| 0x00D7 | `v_d7`, `v_d8`, `v_d7d8`, `w_d7` | `beep_ticks_left` | med | u16 = duration*10/15, decremented per tick |
| 0x00D9 | `var_d9` | `button_cmd` | high | set by 'T' command from serial_buf[0] |
| 0x00DA | `var_da`, `b_da` | `cmd_e_pending` | med | set by 'E'; consumed and cleared by update_stream_step |
| 0x00DB | `ptr_00db`, `ring_wr` | `event_ring_wr` | high | write pointer, wraps 0x0113 to 0x00E9 |
| 0x00DD | `table_dd` (x6) | `ctl_cmd_table[6]` | med | cmd C target; composer reads `& 0xF` as throttle |
| 0x00E5 | `rx_state` | `serial_state` | high | RX parser state and TX-dump state (2) |
| 0x00E6 | `var_e6`, `gE6` | `serial_rx_timeout` | high | decremented by tick; 0 resets serial_state |
| 0x00E7 | `var_e7`, `b_e7` | `cmd_g_param` | med | 'G' parameter; 0x12 triggers bootloader path |
| 0x00E8 | `var_e8`, `prog_e8`, `gE8` | `prog_mode_param` | med | cmd J word 0xF5 value; nonzero makes rails task log only |
| 0x00E9 | `slots` (x48 B), `ring` | `event_ring[8]` | high | 8 x 6 B, init .car=8, read by '?' |
| `event_ring[i]` +0 | `ring[0]` | `.car` | high | car index, 8 = empty marker |
| `event_ring[i]` +1..4 | `ring[1..4]` | `.tick` | high | 32-bit timestamp, 8 hex digits in '?' reply |
| `event_ring[i]` +5 | `ring[5]` | `.chan` | high | channel, 0-based, printed +'1' |
| 0x0119 | `cmd_char` | `cmd_letter` | high | last command character received |
| 0x011A | `rx_ptr` | `serial_ptr` | high | RX parse and TX drain pointer |
| 0x011C | `var_11c`, `var11c`, `link_11c` | `frame_quote_flag` | low | comment: flag for '"' frame in progress |
| 0x011D | `txbuf`, `CMD_PARAM1/2` | `serial_buf` | high | RX params and TX reply buffer |
| 0x017D | `flag_17d` | `ctl_table_stamp` | low | set to 0x3C by cmd C; reader not found |
| 0x017E | `ptr_017e`, `ring_rd` | `event_ring_rd` | high | read pointer used by '?' reply |
| 0x0180 | (x8) | `ctl_rx_table[8]` | med | decoded pulse bytes by address (notes) |
| 0x0188 | `var188`, `v0188` | `ctl_rx_bitcount` | med | decode runs when value is 9 or 10 |
| 0x0189 | `var189` | `ctl_rx_shift` | med | "registre a decalage rail" shifted by INT0/INT2 |
| 0x018A | `var18a` | `ctl_int2_filter` | med | filter fed by GIFR 0x20 (INTF2), sets edge flag bit0 |
| 0x018B | `var18b` | `ctl_rx_phase` | med | measurement state 0..3+ |
| 0x018C | `var18c`, `var_018c` | `ctl_window_ticks` | med | window countdown, 0xA0 set by ctl_window_start |
| 0x018D | `var18d`, `v018d` | `ctl_rx_word` | med | published shift register used by decode |
| 0x018E | `var18e`, `flag_18e` | `ctl_edge_flags` | med | bit0 INT2 seen, bit1 INT0 seen (set by filters) |
| 0x018F | `var18f` | `ctl_int0_filter` | med | filter fed by GIFR 0x40 (INTF0), sets edge flag bit1 |
| 0x0190 | `prog_buf`, `buf190`, `table_190` | `prog_buf[20]` | high | PROG frame, EEPROM @8, checksum at [19] |
| `prog_buf` [0..11] | `table_190[]` | `prog_ticks[6]` | med | u16 per car from cmd J word 2, default 0x3E20 |
| 0x019C | `var_19c`, `v019c` | `cfg_sound_enable` | med | prog_buf[12] default 1; toggled by button; gates beep queue |
| 0x019D | `var_19d` | `cfg_lights_seq_a` | low | prog_buf[13]; copied to/from var_400 in light states |
| 0x019E | `var_19e` | `cfg_lights_seq_b` | low | prog_buf[14]; copied into var_400 |
| 0x019F | `var_19f`, `g19f` | `cfg_slot_default` | low | prog_buf[15]; var_73 = var_19f |
| 0x01A0 | `var_1a0`, `n_1a0` | `cfg_car_count` | high | default 8, toggles 6/8; loop bound, in '?' frame |
| 0x01A1 | `var_1a1`, `b_a1` | `cfg_keep_awake` | med | idle countdown only runs when 0; toggled by button |
| 0x01A2 | `var_1a2`, `g1a2` | `cfg_btn_enable` | med | forces 0x01B4/0x01B5 to 0 when 0 |
| 0x01A3 | `var_1a3` | `prog_checksum` | high | prog_buf[19] = sum of first 19 bytes |
| 0x01A4 | `lead_1a4` | `leader_laps_sent` | med | last leader lap count sent to tower |
| 0x01A6 | `cap_last`, `capA[0]` | `lapsense_a_last` | med | last TCNT2 value |
| 0x01A7 | `cap_period`, `g1a7` | `lapsense_a_car_id` | med | stable period; tick uses (v-1)&7 as car index |
| 0x01A8 | `cap_timeout`, `g1a8` | `lapsense_a_rearm` | med | countdown reset to 5; at 0 re-enables ICP1 |
| 0x01A9 | `cap_div` | `lapsense_a_prev` | med | previous period (/16) |
| 0x01AA | `cap_started` | `lapsense_a_seen` | med | first-measure-done flag |
| 0x01AB | `int1_last`, `capB[0]` | `lapsense_b_last` | med | last TCNT2 value |
| 0x01AC | `int1_period`, `g1ac` | `lapsense_b_car_id` | med | consumed by tick like channel A |
| 0x01AD | `int1_timeout`, `g1ad` | `lapsense_b_rearm` | med | countdown reset to 5; at 0 re-enables INT1 |
| 0x01AE | `int1_div` | `lapsense_b_prev` | med | previous period (/16) |
| 0x01AF | `int1_started` | `lapsense_b_seen` | med | first-measure-done flag |
| 0x01B0 | `g1b0`, `var_1b0` | `tick_clock32` | high | 32-bit clock, ++ in tick under cli/sei |
| 0x01B4 | `var_1b4`, `g1b4` | `btn_b0_held` | med | buttons_scan: PINB0 low AND cfg_btn_enable |
| 0x01B5 | `var_1b5`, `g1b5` | `btn_c6_held` | med | buttons_scan: PINC6 low AND cfg_btn_enable |
| 0x01B6 | `flag_1b6`, `mode_1b6` | `rank_mode` | high | '=' bit1; selects rank_compute_b |
| 0x01B7 | `var_1b7`, `arm_1b7` | `car_arm_mask` | low | per-address mask; rails task skips when bit set |
| 0x01B8 | `var_1b8`, `b_1b8` | `start_window_ticks` | low | decremented per tick; gates special reply bits |
| 0x01BA | `var_1ba`, `WORD_INDEX` | `cycle_idx` | high | index in 10-word cycle; table62 advances it |
| 0x01BB | `b_1bb` | `inject_head` | high | queue head, `& 0x1F` |
| 0x01BD | (x32 u16) | `inject_queue[32]` | high | `((word<<4) OR value)` entries |
| 0x01FD | `var_1fd` | `reply_phase` | med | 0..0x10 sampling phase, consumed by 0x324A |
| 0x01FF | `b_1ff` | `stream_key` | low | running subtract key in update_frame_decode; init 0x38 |
| 0x0200 | `var_200[]` | `slot_active[6]` | low | comment "actifs (6 o)" |
| 0x020F | `flag_20f`, `var_20f` | `ta_off_flag` | low | TA bit = (btn held) AND (flag==0) in composer |
| 0x0210 | `var_210` | `op_mode` | med | 2 = standby; main loop skips sampling |
| 0x0212 | `var_212`, `excl_212` | `exclusion_mask` | high | cmd ':' mask; rails task skips excluded address |
| 0x0214 | `var_214` | `ctl_edge_flags_prev` | med | comment "image precedente de 0x018E" |
| 0x0215 | `var_215` | `reply_bits` | med | 16-bit bits accumulated per window |
| 0x0218 | `state_218`, `g218` | `sm_state` | high | switch variable of state_machine_run |
| 0x0219 | `var_219` | `status_byte_219` | low | two nibbles sent as '0'+value in '?' frame |
| 0x021A | `var_21a` | `tx_period` | high | next OCR1A value, loaded from slot+7 |
| 0x021C | `slots`, `SLOTS`, `slot16` | `slot[10]` | high | 16-byte structs at 0x21C + 16*i |
| `slot[i]` +0 | `st[0]`, `f0` | `.throttle` | high | 4 gas bits G3..G0 of the word |
| `slot[i]` +1 | `st[1]`, `f1` | `.sw` | high | SW bit (0 = pressed) |
| `slot[i]` +2, +3 | free | `.bot_throttle`, `.bot_spare` | high | unused by firmware, used by bot (BOT_GAZ) |
| `slot[i]` +4 | `st[4]` | `.throttle_alt` | med | second pair, used when `which != 0` |
| `slot[i]` +5 | `st[5]` | `.sw_alt` | med | second pair SW, init 1 |
| `slot[i]` +6 | `st[6]` | `.bit_count` | high | 9 normally, 12 for slot 6, 7 for slots 8-9 |
| `slot[i]` +7..8 | `st+7` | `.period` | high | OCR1A reload, init 6600 |
| `slot[i]` +9..10 | `st+9` | `.prog_ticks` | med | from prog_buf, cmd J word 2 (b*1988) |
| `slot[i]` +11 | `f11` | `.status_a` | low | printed '0'+f11 for cars 0..5 in '?' |
| `slot[i]` +12 | `f12` | `.reply_flag` | low | set to 1 by reply decode; mask bits in '?' |
| `slot[i]` +14..15 | `st+14` | `.word` | high | composed 9-bit word, loaded into shifter |
| 0x021F | `BOT_MASK` | `BOT_MASK` (= `slot[0].bot_spare`) | high | keep; bit per bot-controlled address |
| 0x022F | `LANE_PENDING` | `LANE_PENDING` (= `slot[1].bot_spare`) | high | keep; armed lane change bit |
| 0x021E | `BOT_GAZ(i)` | `BOT_THROTTLE(i)` | high | slot i byte 2; throttle word bits for bot |
| 0x0282 | `var_282`, `var_283` | `slot[6].bit_count`, `.period` | high | 0x21C+6*16+6; init 12 bits, 0x189C |
| 0x0290 | `var_290`, `var_291` | `slot[7].throttle_alt`, `.sw_alt` | high | 0x28C+4, +5 per machine_etats comment |
| 0x02A2 | `var_2a2`, `var_2a3` | `slot[8].bit_count`, `.period` | high | init 7 bits, 0x1A90 |
| 0x02B2 | `var_2b2`, `var_2b3` | `slot[9].bit_count`, `.period` | high | init 7 bits, 0x1A90 |
| 0x02BC | `var_2bc` | `idle_timeout` | med | 0x3CF0 at boot; at 0 calls power_down_or_blink |
| 0x02BE | `cars`, `CARS`, `car_t` | `car[8]` | high | 8 x 35 B, set by tick and rails task |
| `car[i]` +0 | `pos`, `cnt` | `.laps` | med | u16 pass counter, rails_emitter reading |
| `car[i]` +2 | `time`, `t02`, `b02` | `.pulse_time` | med | tick snapshot of clock32 on pulse |
| `car[i]` +6 | `last`, `t06` | `.last_time` | med | last processed event time |
| `car[i]` +0x0A | `best`, `t0a` | `.best_lap` | med | init 86400000, min lap time |
| `car[i]` +0x0E | `prev`, `t0e` | `.prev_time` | med | previous crossing, lap time = a - prev |
| `car[i]` +0x12 | `mins[3]`, `b12/b16/b1a` | `.min_gap[3]` | med | min per channel, init 0xFFFF |
| `car[i]` +0x1E | `armed`, `b1e` | `.armed_chan` | med | set by tick, cleared by rails task |
| `car[i]` +0x1F | `chan`, `b1f` | `.last_chan` | med | last channel-1 processed |
| `car[i]` +0x20 | `pos`, `c20` | `.rank` | med | init 8 = unranked; written by rank_compute_* |
| `car[i]` +0x21 | `possent`, `c21` | `.rank_sent` | med | last rank sent to tower |
| `car[i]` +0x22 | `flag22`, `act` | `.seen` | med | car already seen on channel 1 |
| 0x03D6 | `var_3d6`, `w_3d6` | `tx_shift_reg` | high | shifted right 1 bit per COMPB interrupt |
| 0x03D8 | `b_3d8` | `stream_checksum` | low | accumulates stream bytes; ~value sent |
| 0x03D9 | `w_3d9` | `lights_step_timer` | med | countdown reload 0x10 steps lights_pattern |
| 0x03DB | `flag_db`, `var_3db` | `adc_fault_flag` | low | set when ch6/ch7 out of range; stops TX output |
| 0x03DD | `var_3dd` | `reply_addr` | med | address of word being sampled (mot>7: mot-2) |
| 0x03DF | `var_3df`, `b_3df` | `tx_bits_left` | high | countdown; 0 triggers reload; 0xFF = word done |
| 0x03E0 | (x32) | `inject_repeat[32]` | high | repeat counts per inject_queue entry |
| 0x0400 | `var_400`, `g400` | `seq_step` | low | counter stepped in start/light states |
| 0x0401 | `var_401` | `reply_seen_mask` | low | bit set per replying word position |
| 0x0402 | (x8 u16) | `adc_raw[8]` | high | `((u16*)0x0402)[ADMUX&7]` |
| 0x040E | `w_40e` | `adc_raw[6]` | high | comment "adc ch6" |
| 0x0410 | `w_410` | `adc_raw[7]` | high | comment "adc ch7", threshold reference |
| 0x0412 | `var_412` | `tx_clock_snap` | med | copy of tick_clock32 at word reload |
| 0x0416 | `b_416` | `lights_pattern` | med | binary value driving PORTC3/2/7 and PORTA5/4 |

## 3. Source files (applied 2026-10-11)

| Current | Proposed | Note |
|---|---|---|
| `SOURCES/boucle_principale.c` | `main_loop.c` | rail cycle service, TX ISR, slots init, reply step; `rail_cycle.c` would fit better |
| `SOURCES/cmd_C_formes.c` | `cmd_c_forms.c` | cmd C code-shape variants (history) |
| `SOURCES/cmd_J.c` | `cmd_prog_car.c` | |
| `SOURCES/cmd_io_version_excl.c` | `cmd_i_version_exclusion.c` | cmd I, version, exclusion, symbolic tests |
| `SOURCES/cmd_status_frame.c` | `cmd_status_frame.c` | already English |
| `SOURCES/compositeur_formes.c` | `word_compose_forms.c` | slot_word_compose variants (history) |
| `SOURCES/dispatcher_compositeur.c` | `cmd_dispatcher_word_composer.c` | dispatcher + word composer |
| `SOURCES/divers_manettes.c` | `controllers_misc.c` | ring reset, beep push, checksum, pulse decode |
| `SOURCES/envoyer_somme_formes.c` | `reply_checksum_forms.c` | variants of 0x01EA and 0x0B44 |
| `SOURCES/isr_batch1.c` | `isr_batch1.c` | already English (serial TX, capture A, INT1) |
| `SOURCES/isr_batch2.c` | `isr_batch2.c` | already English (serial RX, Timer0, INT0, INT2) |
| `SOURCES/lot_15xx_1Axx.c` | `batch_15xx_1axx.c` | ADC, inject queue, timers, hex parse, chase |
| `SOURCES/machine_etats.c` | `state_machine.c` | |
| `SOURCES/main_exit.c` | `main_exit.c` | already English |
| `SOURCES/parseur_base.c` | `parser_base.c` | cmd T, checksum, tick poll, capture arm |
| `SOURCES/parseur_reglages.c` | `parser_settings.c` | cmd '=', Timer0 window start, PROG defaults |
| `SOURCES/rails_emitter.c` | `rails_emitter.c` | already English |
| `SOURCES/reset_01A6.c` | `event_ring_reset.c` | |
| `SOURCES/somme_formes.c` | `sum_bytes_forms.c` | |
| `SOURCES/tick_timer2.c` | `timer2_tick.c` | |
| `SOURCES/tracker_ranks.c` | `rank_tracker.c` | car table reset, buttons scan, rank a/b |
| `SOURCES/README-INDEX.md` | `README-INDEX.md` | doc, already English name |
| `BOT/bot_mode.c`, `stubs_bot.S`, `build_bot.py` | unchanged | already English |
| `TOOLS/SUIVI-fonctions.tsv` | `function-tracking.tsv` | optional |
| `TOOLS/01-archeologie-compilateur.md` | `01-compiler-archaeology.md` | optional |
| `TOOLS/notes-firmware-V339.md` | `firmware-notes-v339.md` | optional |
| `TOOLS/RECETTE-matching.md` | `matching-recipe.md` | optional |

## 4. Open questions

Provisional placeholders use `unk_` (address-based on purpose, to be replaced).

1. **0x15B0** `FUN_code_0ad8` (72 B, "a faire"): no source, only a note mentioning "etat manettes/lights". Placeholder `unk_fn_15b0`.
2. **0x1C44** `f_1c44`: returns a flag tested in states 11/24/31 (zero vs nonzero), role unknown, no SUIVI row. Placeholder `unk_fn_1c44`.
3. **0x14D8** vs **0x144C**: SUIVI gives `lire_boutons` 140 B at 0x144C (ends exactly at 0x14D8) yet the state machine calls `f_14d8`, whose results match button codes 1-8. Either 0x14D8 is a separate 76 B wrapper (the "recompile = 76 B" note) or the SUIVI address/size is off.
4. **0x1A5C** `update_stream_step`: the notes call it the gas-word composer (reads `~gas` from 0x7B+adr); the source shows an 'E'-frame stream sequencer ending in a function-pointer call. Same conflict for RAM 0x0074-0x007B and 0x008C-0x008E (proposed `stream_*`, `update_entry_fnptr`, not in the table).
5. **0x2A4E vs 0x1C76**: SUIVI row 0x2A4E (`logique_course`, 1414 B) merges the word-cycle code and the state machine (0x1C76, 3542 B); 0x2A4E+1414 passes 0x2F8A. Split the row; confirm the `jmp 0x1C76` at 0x2E3C.
6. **0x324A** role: `main_exit.c` calls it "machine etats evenement manette", the code reads ADC bits in TCNT1 windows and decodes 3-bit message types. Is it a car reply receiver or a controller sampler? Name kept low.
7. **`slot[i].status_a` (+11)** and **`.reply_flag` (+12)**: printed in the '?' frame but never explained. `.prog_ticks` (+9..10) meaning of b*1988 also unknown.
8. **`car[i]` +0x06/+0x0A/+0x0E**: `rails_emitter.c` says last/best/prev, `tracker_ranks.c` and `tick_timer2.c` say t06/t0a/t0e with different semantics. Proposed names follow `rails_emitter.c`.
9. **TA / flags**: meaning of `ta_off_flag` (0x020F), `btn_b0_held`, `btn_c6_held`, and the '?' flag byte (bits from 0x1B5, 0x1B4, 0x20F, PINB1) is not established.
10. Bytes with no usable evidence: 0x01B9 (`unk_blink_01b9`, blink divider in power_down_or_blink), 0x01BC (`unk_flag_01bc`, set by reply bit 1, tick beeps when set), 0x01FE (`unk_flag_01fe`), 0x020E (`unk_mask_020e`, bit per address set/cleared by reply decode), 0x0213 (`unk_flag_0213`, cmd J word 6 value 9), 0x0217 (`unk_flag_0217`), 0x0400 and 0x0219 (low-confidence names above).
11. **Inject queue drain**: who consumes `inject_queue` and moves words to 0x01B0-0x01B3 / the shifter is still unknown (notes, open question 1). Tail index unnamed.
12. **Word index roles**: notes say 6 = pace car, 7 = programming; `bot_mode.c` says 6 = programming, 7 = pace car. No `cycle_idx` role names proposed until settled.
13. **Comment errors in sources**: `isr_batch2.c` labels 0x018F/0x018A as INT1/INT0 filters while the GIFR bits (0x40, 0x20) mean INT0/INT2; `isr_int2` comment says it disables INT1 but `GICR &= ~0x40` is INT0. `main_exit.c` calls 0x03DF a "mode selector". The glossary follows the bit positions.
14. **SUIVI inconsistencies**: row 0x01A6 semantic name `reset` clashes with crt reset @0x00E4; `tracker_ranks.c` header says `lire_boutons` 140/140 at link while SUIVI says 137/140.
15. **Other unknowns**: `buzzer_set_mode` mode 4 branch (SUIVI shows only the `m != 2`/`m == 4` structure) and `cmd_i_send` purpose.

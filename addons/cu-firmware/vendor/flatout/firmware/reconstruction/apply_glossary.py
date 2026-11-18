#!/usr/bin/env python3
"""Apply the renaming glossary (docs/glossary.md) to the reconstructed sources.

- Global identifiers (functions, globals) are renamed in every .c file.
- Struct fields are renamed per file (the struct shapes differ between files).
- Code-shape variants (cva, r2a, s1, tsym_*, f01a6_*) become <canonical>_vN.
- Addresses stay in trailing comments; names never carry them.

Run:  python3 apply_glossary.py            (applies, shows a report)
      python3 apply_glossary.py --dry      (report only)

After applying: recompile every file with the pinned toolchain and re-score at
least two functions against firmware/decodes/V339.bin to prove the byte-exactness
survived (renames must not change a single byte of code).
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"

# ---------------------------------------------------------------- global names
MAP = {
    # ---- functions: serial / commands
    "envoyer_buffer": "reply_append_checksum",
    "cmd_version": "cmd_version_send", "tsym_V": "cmd_version_send_v0",
    "cmd_exclusion": "cmd_exclusion_set", "tsym_X": "cmd_exclusion_set_v0",
    "tsym_Xv": "cmd_exclusion_set_v1",
    "cmd_J": "cmd_prog_car", "cmd_J_programmer": "cmd_prog_car",
    "cmd_T": "cmd_button_set", "r1_cmd_T": "cmd_button_set_v0",
    "cmd_C": "cmd_ctl_table_set", "tsym_C": "cmd_ctl_table_set_v0",
    "cva": "cmd_ctl_table_set_v1", "cvb": "cmd_ctl_table_set_v2",
    "cvc": "cmd_ctl_table_set_v3", "cvd": "cmd_ctl_table_set_v4",
    "cmd_status": "cmd_status_send", "cmd_status_timing": "cmd_status_send",
    "cmd_I": "cmd_i_send", "tsym_I": "cmd_i_send_v0",
    "cmd_reset_chrono": "cmd_timer_reset",
    "disp_r": "cmd_dispatch", "disp_b": "cmd_dispatch_v2", "disp_s": "cmd_dispatch_v3",
    "f_374": "cmd_status_send", "f_24a": "cmd_timer_reset", "f_28c": "cmd_prog_car",
    "f_06a8": "cmd_dispatch",
    # ---- functions: ISRs
    "isr_udre": "serial_tx_isr", "isr_rxc": "serial_rx_isr",
    "isr_capt": "lapsense_a_isr", "isr_int1": "lapsense_b_isr",
    "isr_t0": "ctl_pulse_window_isr", "isr_int0": "ctl_pulse0_isr",
    "isr_int2": "ctl_pulse2_isr", "isr_t1c": "rail_tx_shift_isr",
    "ISR_NED": "ISR_NAMED",
    # ---- functions: controllers / sensors
    "f0a8e": "ctl_pulse_decode", "f_0a8e": "ctl_pulse_decode",
    "r7": "ctl_window_start", "f_b02": "ctl_window_start",
    "set_timer2": "buzzer_set_mode", "t12_set_timer2": "buzzer_set_mode_v0",
    "f140": "beep_queue_push", "f0140": "beep_queue_push",
    "f01a6": "event_ring_reset", "f_01a6": "event_ring_reset",
    "f01a6_i": "event_ring_reset_v1", "f01a6_p": "event_ring_reset_v2",
    "f01a6_lt": "event_ring_reset_v3",
    "f_01ce": "serial_init", "init_serial": "serial_init",
    "f1524": "rail_reply_bit_read", "f_0a92": "rail_reply_bit_read",
    "f155c": "power_down_or_blink", "f_155c": "power_down_or_blink",
    "f162c": "adc_sample_channels", "f_162c": "adc_sample_channels",
    "f16f2": "adc_to_throttle_level", "f1728": "timers_update",
    "f_1728": "timers_update", "f18c0": "hex_parse",
    "f18f2": "update_frame_decode",
    "f1a2c": "lights_chase_step", "f_0d16": "lights_chase_step",
    "f1a5c": "update_stream_step", "f_1a5c": "update_stream_step",
    "f_0b5c": "prog_buf_set_defaults", "f_05ae": "prog_buf_set_defaults",
    "r8a": "prog_buf_set_defaults_v2", "r8b": "prog_buf_set_defaults_v1",
    "somme": "sum_bytes", "f0b44": "sum_bytes",
    "r4": "sum_bytes_v0", "r4a": "sum_bytes_v1", "r4b": "sum_bytes_v2",
    "r4c": "sum_bytes_v3", "r4d": "sum_bytes_v4",
    "s1": "sum_bytes_v5", "s2": "sum_bytes_v6", "s3": "sum_bytes_v7",
    "s4": "sum_bytes_v8", "s5": "sum_bytes_v9", "s6": "sum_bytes_v10",
    "r2a": "reply_append_checksum_v1", "r2b": "reply_append_checksum_v2",
    "r2c": "reply_append_checksum_v3", "r2d": "reply_append_checksum_v4",
    "r2e": "reply_append_checksum_v5", "r2g": "reply_append_checksum_v6",
    "r2i": "reply_append_checksum_v7", "r2j": "reply_append_checksum_v8",
    # ---- functions: timing / rails
    "r3": "timer2_tick_poll", "f_0ea2": "timer2_tick_poll",
    "fonc_C": "timer2_tick_service", "f_0c6e": "timer2_tick_service",
    "f_0eb8": "rail_events_process", "f_2f8a": "rail_cycle_service",
    "f_3146": "slots_init", "f_31f8": "rail_tx_init", "f_324a": "rail_reply_rx_step",
    "r5": "lapsense_capture_arm", "f_128c": "lapsense_capture_arm",
    "f15f8": "inject_queue_push", "f_0afc": "inject_queue_push",
    "f_15f8": "inject_queue_push",
    "f18c0": "hex_parse",
    # ---- functions: race / tracker
    "f_sm": "state_machine_run", "t12_set_timer2": "buzzer_set_mode_v0",
    "trk_init": "car_table_reset", "f_13dc": "car_table_reset",
    "trk_rank_a": "rank_compute_a", "f_12ae": "rank_compute_a",
    "trk_rank_b": "rank_compute_b", "f_1344": "rank_compute_b",
    "trk_rank_a": "rank_compute_a",
    "lire_boutons": "buttons_scan", "f_14d8": "button_event_get",
    "comp": "slot_word_compose", "f_754": "slot_word_compose",
    "comp3": "slot_word_compose_v3", "comp4": "slot_word_compose_v4",
    "main": "main", "exit": "exit",
    # ---- BOT
    "gaz_rails": "throttle_to_rail_bits", "cmd_B": "cmd_bot_set",
    "BOT_GAZ": "BOT_THROTTLE",
    # ---- globals: system / timing
    "rr_6c": "rails_rr_idx", "st_6d": "rails_phase",
    "ptr_60": "eeprom_save_src", "ptr_6f": "eeprom_save_addr",
    "var_71": "start_light_level", "var_72": "button_event_last",
    "var_73": "slot_target", "cnt_8d": "timers_div4",
    "w_90": "pd5_pulse_ticks", "var_90": "pd5_pulse_ticks",
    "var_92": "delay_ticks", "w_92": "delay_ticks",
    "b_d4": "beep_q_rd", "v_d5": "beep_q_wr", "b_d5": "beep_q_wr",
    "v_d7": "beep_ticks_left", "v_d8": "beep_ticks_left_hi",
    "v_d7d8": "beep_ticks_left", "w_d7": "beep_ticks_left",
    "var_d9": "button_cmd", "var_da": "cmd_e_pending", "b_da": "cmd_e_pending",
    "ptr_00db": "event_ring_wr", "ring_wr": "event_ring_wr",
    "ptr_017e": "event_ring_rd", "ring_rd": "event_ring_rd",
    "table_dd": "ctl_cmd_table",
    # ---- globals: serial
    "rx_state": "serial_state", "var_e6": "serial_rx_timeout", "gE6": "serial_rx_timeout",
    "var_e7": "cmd_g_param", "b_e7": "cmd_g_param",
    "var_e8": "prog_mode_param", "prog_e8": "prog_mode_param", "gE8": "prog_mode_param",
    "cmd_char": "cmd_letter", "rx_ptr": "serial_ptr",
    "var_11c": "frame_quote_flag", "var11c": "frame_quote_flag", "link_11c": "frame_quote_flag",
    "txbuf": "serial_buf", "CMD_PARAM1": "serial_buf", "CMD_PARAM2": "serial_buf",
    "flag_17d": "ctl_table_stamp",
    # ---- globals: controllers
    "var188": "ctl_rx_bitcount", "v0188": "ctl_rx_bitcount",
    "var189": "ctl_rx_shift", "var18a": "ctl_int2_filter",
    "var18b": "ctl_rx_phase", "var18c": "ctl_window_ticks", "var_018c": "ctl_window_ticks",
    "var18d": "ctl_rx_word", "v018d": "ctl_rx_word",
    "var18e": "ctl_edge_flags", "flag_18e": "ctl_edge_flags",
    "var18f": "ctl_int0_filter",
    "var_19c": "cfg_sound_enable", "v019c": "cfg_sound_enable",
    "var_19d": "cfg_lights_seq_a", "var_19e": "cfg_lights_seq_b",
    "var_19f": "cfg_slot_default", "g19f": "cfg_slot_default",
    "var_1a0": "cfg_car_count", "n_1a0": "cfg_car_count",
    "var_1a1": "cfg_keep_awake", "var_1a2": "cfg_btn_enable", "g1a2": "cfg_btn_enable",
    "var_1a3": "prog_checksum", "lead_1a4": "leader_laps_sent",
    "cap_last": "lapsense_a_last", "cap_period": "lapsense_a_car_id", "g1a7": "lapsense_a_car_id",
    "cap_timeout": "lapsense_a_rearm", "g1a8": "lapsense_a_rearm",
    "cap_div": "lapsense_a_prev", "cap_started": "lapsense_a_seen",
    "int1_last": "lapsense_b_last", "int1_period": "lapsense_b_car_id", "g1ac": "lapsense_b_car_id",
    "int1_timeout": "lapsense_b_rearm", "g1ad": "lapsense_b_rearm",
    "int1_div": "lapsense_b_prev", "int1_started": "lapsense_b_seen",
    # ---- globals: race
    "g1b0": "tick_clock32", "var_1b0": "tick_clock32",
    "var_1b4": "btn_b0_held", "g1b4": "btn_b0_held",
    "var_1b5": "btn_c6_held", "g1b5": "btn_c6_held",
    "flag_1b6": "rank_mode", "mode_1b6": "rank_mode",
    "var_1b7": "car_arm_mask", "arm_1b7": "car_arm_mask",
    "var_1b8": "start_window_ticks", "b_1b8": "start_window_ticks",
    "var_1ba": "cycle_idx", "WORD_INDEX": "cycle_idx",
    "b_1bb": "inject_head",
    "var_1fd": "reply_phase", "b_1ff": "stream_key", "var_200": "slot_active",
    "flag_20f": "ta_off_flag", "var_20f": "ta_off_flag",
    "var_210": "op_mode", "var_212": "exclusion_mask", "excl_212": "exclusion_mask",
    "var_214": "ctl_edge_flags_prev", "var_215": "reply_bits",
    "state_218": "sm_state", "g218": "sm_state",
    "var_219": "status_byte_219", "var_21a": "tx_period",
    "var_2bc": "idle_timeout",
    "var_3d6": "tx_shift_reg", "w_3d6": "tx_shift_reg",
    "b_3d8": "stream_checksum", "w_3d9": "stream_checksum_prev",
    "flag_db": "adc_fault_flag", "var_3db": "adc_fault_flag",
    "var_3dd": "reply_addr", "var_3df": "tx_bits_left", "b_3df": "tx_bits_left",
    "var_400": "seq_step", "g400": "seq_step", "var_401": "reply_seen_mask",
    "w_40e": "adc_raw[6]", "w_410": "adc_raw[7]",
    "var_412": "tx_clock_snap", "b_416": "lights_pattern",
    "table_190": "prog_ticks", "buf190": "prog_buf",
    "var_282": "slot6_bit_count", "var_283": "slot6_period",
    "var_290": "slot7_throttle_alt", "var_291": "slot7_sw_alt",
    "var_2a2": "slot8_bit_count", "var_2a3": "slot8_period",
    "var_2b2": "slot9_bit_count", "var_2b3": "slot9_period",
    "slot16": "slot16", "SLOTS": "SLOTS", "SLOT16": "SLOT16",
}

# ------------------------------------------------------------- struct fields
FIELDS = {
    "cmd_status_frame.c": {f"f{i}": n for i, n in enumerate(
        ["throttle", "sw", "bot_throttle", "bot_spare", "throttle_alt", "sw_alt",
         "bit_count", "period_lo", "period_hi", "prog_ticks_lo", "prog_ticks_hi",
         "status_a", "reply_flag", "spare13", "word_lo", "word_hi"])},
    "rank_tracker.c": {"b02": "tick_snapshot", "b12": "min_gap0", "b16": "min_gap1",
                       "b1a": "min_gap2", "b1e": "armed_chan", "b1f": "last_chan",
                       "c20": "rank", "c21": "rank_sent", "act": "seen"},
    "timer2_tick.c": {"b02": "pulse_time_lo", "b1e": "armed_chan", "b1f": "last_chan",
                      "c20": "rank", "c21": "rank_sent", "act": "seen"},
    "rails_emitter.c": {"armed": "armed_chan", "last": "last_time", "prev": "prev_time",
                        "chan": "last_chan", "pos": "laps", "cnt": "lap_counter",
                        "mins": "min_gap", "possent": "rank_sent", "flag22": "seen"},
}

WORD = re.compile(r"(?<![A-Za-z0-9_]){}\b(?!\s*\()")


def apply_map(text, mapping):
    n = 0
    for old, new in sorted(mapping.items(), key=lambda kv: -len(kv[0])):
        if old == new or "[" in new:      # array-index targets handled separately
            continue
        pat = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(old) + r"\b")
        text, k = pat.subn(new, text)
        n += k
    return text, n


def main():
    dry = "--dry" in sys.argv
    total = 0
    for f in sorted(SRC.glob("*.c")):
        text = f.read_text()
        text2, n1 = apply_map(text, MAP)
        text2, n2 = apply_map(text2, FIELDS.get(f.name, {}))
        if n1 + n2:
            total += n1 + n2
            print(f"{f.name:36s} {n1 + n2:4d} renames")
            if not dry:
                f.write_text(text2)
    print(f"\n{total} identifiers renamed" + (" (dry run, nothing written)" if dry else ""))
    print("Now recompile everything and re-score at least two functions to prove "
          "the byte-exactness is unchanged.")


if __name__ == "__main__":
    main()

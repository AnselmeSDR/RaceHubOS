/* stubs.S — assembly hooks (linked WITH the C, see build_bot.py).
 * (two-word name to avoid the macOS case collision with bot_stubs.s/.S)
 *
 * Address convention (validated byte-for-byte by review):
 *   - `out` takes I/O ADDRESSES: UDR = 0x0C (Ghidra's "0x2C" notation is the
 *     memory address, review pitfall C5).
 *   - `jmp/call` in gas take the file's BYTE address.
 *
 * STUB1: called by P1 (jmp @0x05FC, error-path area of the serial ISR).
 *         R24 = received character. 'B' -> "params" path; otherwise replays
 *         exactly the original error path (state 0, reply '#' via UDR).
 * STUB2: called by P2 (jmp @0x06E6, first access of the state-7 dispatcher).
 *         Replays the overwritten instruction (sts 0x00e6,r1), routes 'B' to cmd_bot_set,
 *         then rejoins the original flow at 0x06EA ('$' acknowledgement and return
 *         to state 0 done by the original code).
 * STUB3: hooked by P3 (jmp @0x304A, the 2 sts toward the builder's TX shifter).
 *         Calls bot_hook_word (C), redoes the overwritten stores, rejoins 0x3052.
 *         P3 is a JMP (not a call): STUB3 does not touch the stack (review C4).
 */
STUB1:
  cpi   r24, 0x42          ; 'B' ?
  brne  STUB1_err
  ldi   r24, 0x1d          ; <— original "params" path (0x05E4..):
  ldi   r25, 0x01          ;     buffer = 0x011D, state = 3 (collect until '$')
  sts   0x011b, r25
  sts   0x011a, r24
  ldi   r24, 0x03
  sts   0x00e5, r24
  rjmp  STUB1_fin
STUB1_err:                 ; <— replays the original error path
  sts   0x00e5, r1         ; state 0
  ldi   r24, 0x23          ; '#'
  out   0x0c, r24          ; UDR  (I/O 0x0C — review C5)
STUB1_fin:
  jmp   0x0604             ; common end of ISR (after the patched area)

STUB2:
  sts   0x00e6, r1         ; <— replays the overwritten instruction (P2)
  lds   r24, 0x0119        ; the command letter
  cpi   r24, 0x42          ; 'B' ?
  brne  STUB2_fin
  call  cmd_bot_set              ; our parser (C)
STUB2_fin:
  jmp   0x06ea             ; original dispatcher continuation (ack '$', state 0)

STUB3:
  call  bot_hook_word      ; R25:R24 -> R25:R24 (standard AVR ABI)
  sts   0x03d7, r25        ; <— replays the overwritten stores (P3)
  sts   0x03d6, r24
  jmp   0x3052             ; original builder continuation

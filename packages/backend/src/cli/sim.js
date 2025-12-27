#!/usr/bin/env node
import React, { useState, useEffect, createElement as h } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { io } from 'socket.io-client';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3000';

const CU_STATES = ['RACING', 'L1', 'L2', 'L3', 'L4', 'L5', 'FALSE_START', 'GO', '?', 'STOPPED'];

const socket = io(WS_URL);

function App() {
  const { exit } = useApp();
  const [connected, setConnected] = useState(false);
  const [cuStatus, setCuStatus] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-15), { time, msg, type }]);
  };

  // Socket events
  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      addLog('WebSocket connected', 'success');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addLog('WebSocket disconnected', 'error');
    });

    socket.on('cu:status', (status) => {
      setCuStatus(prev => {
        if (prev?.start !== status.start) {
          addLog(`→ ${CU_STATES[status.start] || status.start}`, 'state');
        }
        return status;
      });
    });

    socket.on('cu:timer', (data) => {
      if (data.lapTime > 0) {
        addLog(`LAP ctrl=${data.controller + 1} ${(data.lapTime / 1000).toFixed(3)}s`, 'lap');
      }
    });

    socket.on('cu:connected', () => addLog('Device connected', 'success'));
    socket.on('cu:disconnected', () => {
      setCuStatus(null);
      addLog('Device disconnected', 'error');
    });

    socket.on('session:heartbeat', (data) => {
      setSessionStatus(data);
    });

    return () => socket.disconnect();
  }, []);

  // Commands
  const execCmd = async (cmd) => {
    const [command, ...args] = cmd.trim().toLowerCase().split(/\s+/);
    addLog(`> ${cmd}`, 'cmd');

    try {
      switch (command) {
        case 'c':
        case 'connect':
          await fetch(`${API_URL}/api/bluetooth/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: 'SIMULATOR' })
          });
          break;

        case 'd':
        case 'disconnect':
          await fetch(`${API_URL}/api/bluetooth/disconnect`, { method: 'POST' });
          break;

        case 'start':
        case 's':
          await fetch(`${API_URL}/api/bluetooth/button/2`, { method: 'POST' });
          break;

        case 'esc':
        case 'stop':
          await fetch(`${API_URL}/api/bluetooth/button/1`, { method: 'POST' });
          break;

        case 'lap':
        case 'l': {
          const ctrl = parseInt(args[0]) - 1;
          if (isNaN(ctrl) || ctrl < 0 || ctrl > 5) {
            addLog('Usage: lap <1-6>', 'error');
            break;
          }
          await fetch(`${API_URL}/api/bluetooth/simulator/lap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ controller: ctrl })
          });
          break;
        }

        case 'reset':
          await fetch(`${API_URL}/api/bluetooth/simulator/reset`, { method: 'POST' });
          addLog('Simulator reset', 'success');
          break;

        case 'state': {
          const stateMap = { racing: 0, l1: 1, l2: 2, l3: 3, l4: 4, l5: 5, false: 6, go: 7, stopped: 9 };
          let stateVal = parseInt(args[0]);
          if (isNaN(stateVal)) {
            stateVal = stateMap[args[0]?.toLowerCase()];
          }
          if (stateVal === undefined || stateVal < 0 || stateVal > 9) {
            addLog('Usage: state <0-9|racing|l1-l5|go|stopped>', 'error');
            break;
          }
          await fetch(`${API_URL}/api/bluetooth/simulator/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: stateVal })
          });
          break;
        }

        case 'fuel':
        case 'f': {
          const ctrl = parseInt(args[0]) - 1;
          const val = parseInt(args[1]);
          if (isNaN(ctrl) || ctrl < 0 || ctrl > 5 || isNaN(val) || val < 0 || val > 15) {
            addLog('Usage: fuel <1-6> <0-15>', 'error');
            break;
          }
          await fetch(`${API_URL}/api/bluetooth/set-fuel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: ctrl, value: val })
          });
          addLog(`Fuel ctrl=${ctrl + 1} → ${val}`, 'success');
          break;
        }

        case 'clear':
          setLogs([]);
          break;

        case 'q':
        case 'quit':
        case 'exit':
          exit();
          break;

        case 'help':
        case '?':
          addLog('c connect | s start | esc | l lap <1-6>', 'info');
          addLog('state <racing|l1-l5|go|stopped> | f fuel <1-6> <0-15>', 'info');
          addLog('reset | clear | q quit', 'info');
          break;

        default:
          if (command) addLog(`Unknown: ${command}`, 'error');
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    }
  };

  const handleSubmit = (value) => {
    if (value.trim()) {
      setHistory(prev => [...prev, value]);
      setHistoryIdx(-1);
      execCmd(value);
    }
    setInput('');
  };

  useInput((input, key) => {
    if (key.upArrow && history.length > 0) {
      const newIdx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      setInput(history[history.length - 1 - newIdx] || '');
    }
    if (key.downArrow) {
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setInput(newIdx >= 0 ? history[history.length - 1 - newIdx] : '');
    }
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const state = cuStatus ? CU_STATES[cuStatus.start] || cuStatus.start : '-';
  const fuel = cuStatus?.fuel?.join(',') || '-';
  const elapsed = sessionStatus?.elapsedTime ? Math.floor(sessionStatus.elapsedTime / 1000) : null;

  const getColor = (type) => {
    switch (type) {
      case 'error': return 'red';
      case 'success': return 'green';
      case 'lap': return 'yellow';
      case 'state': return 'cyan';
      case 'cmd': return 'magenta';
      default: return undefined;
    }
  };

  return h(Box, { flexDirection: 'column' },
    // Header
    h(Box, { borderStyle: 'round', borderColor: 'cyan', paddingX: 1 },
      h(Text, { bold: true, color: 'cyan' }, 'Carrera Simulator'),
      h(Text, null, '  '),
      h(Text, { color: connected ? 'green' : 'red' }, connected ? '● connected' : '○ disconnected')
    ),

    // Status Bar
    h(Box, { paddingX: 1, gap: 2, marginY: 0 },
      h(Text, null,
        h(Text, { dimColor: true }, 'State: '),
        h(Text, { color: 'cyan', bold: true }, state)
      ),
      h(Text, null,
        h(Text, { dimColor: true }, 'Fuel: '),
        h(Text, null, `[${fuel}]`)
      ),
      elapsed !== null && h(Text, null,
        h(Text, { dimColor: true }, 'Session: '),
        h(Text, { color: 'yellow' }, sessionStatus.status),
        h(Text, { dimColor: true }, ` ${elapsed}s`)
      )
    ),

    // Logs
    h(Box, { flexDirection: 'column', paddingX: 1, marginTop: 1 },
      ...logs.map((log, i) =>
        h(Text, { key: i },
          h(Text, { dimColor: true }, `[${log.time}] `),
          h(Text, { color: getColor(log.type) }, log.msg)
        )
      )
    ),

    // Input
    h(Box, { marginTop: 1, paddingX: 1 },
      h(Text, { color: 'green' }, '❯ '),
      h(TextInput, {
        value: input,
        onChange: setInput,
        onSubmit: handleSubmit,
        placeholder: 'help for commands'
      })
    )
  );
}

render(h(App));

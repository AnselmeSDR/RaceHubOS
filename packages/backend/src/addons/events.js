import { EventEmitter } from 'events';

/**
 * Copies every event the core sends to the browsers (`io.emit`) onto an emitter that
 * add-ons listen to as `ctx.events`. Called once, right after socket.io is created.
 *
 * @param {{ emit: Function }} io the socket.io server
 * @returns {EventEmitter}
 */
export function mirrorEmits(io) {
  const events = new EventEmitter();
  events.setMaxListeners(0);
  const emit = io.emit.bind(io);
  io.emit = (event, ...args) => {
    events.emit(event, ...args);
    return emit(event, ...args);
  };
  return events;
}

/**
 * `ctx.events` for one add-on: listeners can't throw into the core — a failing listener
 * is logged, and the event still reaches the browsers and the other listeners.
 *
 * @param {EventEmitter} coreEvents the mirror from mirrorEmits()
 * @param {{ error: Function }} log
 */
export function createAddonEvents(coreEvents, log) {
  // listener → event → its safe wrapper, so off() finds what on() registered
  const registered = new Map();

  const wrap = (event, listener, once) => {
    const safe = (...args) => {
      if (once) forget(event, listener);
      try {
        const result = listener(...args);
        if (result && typeof result.then === 'function') {
          result.catch((error) => log.error(`listener for "${event}" failed:`, error));
        }
      } catch (error) {
        log.error(`listener for "${event}" failed:`, error);
      }
    };
    if (!registered.has(listener)) registered.set(listener, new Map());
    registered.get(listener).set(event, safe);
    return safe;
  };

  const forget = (event, listener) => {
    const safe = registered.get(listener)?.get(event);
    if (!safe) return;
    coreEvents.off(event, safe);
    registered.get(listener).delete(event);
    if (registered.get(listener).size === 0) registered.delete(listener);
  };

  const events = {
    on(event, listener) {
      forget(event, listener);
      coreEvents.on(event, wrap(event, listener, false));
      return events;
    },
    once(event, listener) {
      forget(event, listener);
      coreEvents.once(event, wrap(event, listener, true));
      return events;
    },
    off(event, listener) {
      forget(event, listener);
      return events;
    },
    /** Removes every listener of this add-on: on shutdown, or when its register() fails. */
    removeAll() {
      for (const [listener, byEvent] of [...registered]) {
        for (const event of [...byEvent.keys()]) forget(event, listener);
      }
    },
  };
  return events;
}

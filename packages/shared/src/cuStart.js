/** CU status is not a zero-based lamp count: 1 is ready, 2..6 light 1..5.
 * Verified against a stationary-car capture: 1,2,3,4,5,6,7,0.
 * The status byte alone does not identify a false start; never invent one from 6.
 */
export function cuStartState(start, connected = true) {
  const phase =
    !connected || !Number.isInteger(start)
      ? 'unknown'
      : start === 1
        ? 'ready'
        : start >= 2 && start <= 6
          ? 'lights'
          : start === 7
            ? 'go'
            : start === 0
              ? 'racing'
              : [8, 9].includes(start)
                ? 'stopped'
                : 'unknown';
  return {
    phase,
    visible: ['ready', 'lights', 'go'].includes(phase),
    count: phase === 'ready' || phase === 'go' ? 5 : phase === 'lights' ? start - 1 : 0,
    go: phase === 'go',
    falseStart: false,
  };
}

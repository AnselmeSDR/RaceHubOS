/** The Control Unit's start light state in words (`t` of the layout namespace). */
export function cuStateLabel(t, start) {
  if (start === 0) return t('cuState.racing')
  if (start >= 1 && start <= 5) return t('cuState.lights', { n: start })
  if (start === 6) return t('cuState.falseStart')
  if (start === 7) return t('cuState.go')
  if (start === 8 || start === 9) return t('cuState.stopped')
  return t('footer.unknown')
}

/** Green while racing, yellow from the lights to the go, muted otherwise. */
export function cuStateColor(start) {
  if (start === 0) return 'text-green-500'
  if (start >= 1 && start <= 7) return 'text-yellow-500'
  return 'text-muted-foreground'
}

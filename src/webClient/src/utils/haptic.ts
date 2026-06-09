export function haptic(ms = 15): void {
  navigator.vibrate?.(ms)
}

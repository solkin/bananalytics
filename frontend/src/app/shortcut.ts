/** How to show the palette shortcut on this keyboard. */
export function shortcutLabel() {
  return /mac|iphone|ipad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
}

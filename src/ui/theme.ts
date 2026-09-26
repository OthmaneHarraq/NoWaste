// Shared colors so every screen looks like one app. Change the palette here, not per screen.
// Same values as the Tailwind tokens in src/global.css (ink, paper, fresh-*, soon-*, spoiled-*).
export const colors = {
  primary: '#23804a',      // fresh green (fresh-600)
  primaryLight: '#eef8f1', // fresh-50
  background: '#fafbf9',   // paper
  surface: '#ffffff',
  text: '#17251f',         // ink
  muted: '#8a9a93',        // mute
  border: '#e2e9e5',       // line
  danger: '#d9493a',       // spoiled-500
  dangerLight: '#fdefed',  // spoiled-50
  warning: '#e39a1b',      // soon-500
  warningLight: '#fff7e8', // soon-50
}

// One depth scale for the whole app, so cards feel like the same material everywhere.
export const shadow = {
  /** Resting cards and panels. */
  card: { shadowColor: '#17251f', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  /** Things that float: tooltips, toasts, the fridge cabinet. */
  raised: { shadowColor: '#17251f', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
}

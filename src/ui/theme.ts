import { Platform } from 'react-native'

// Shared colors so every screen looks like one app. Change the palette here, not per screen.
// Same values as the Tailwind tokens in src/global.css (light and dark).
//
// Dark freshness colours (#2ea864 / #cf8c14 / #e8474f) were checked with the dataviz palette
// validator against the dark surface: all ≥ 3:1 contrast and distinct for normal vision;
// green↔amber is close for protanopes, which is fine because freshness always also has a
// text label ("Expires tomorrow") and, in the Fridge view, the ring's fill level.

export type Palette = {
  primary: string; primaryLight: string
  background: string; surface: string; raised: string; frost: string
  text: string; textSoft: string; muted: string; onInk: string
  border: string; glass: string
  fresh: string; soon: string; spoiled: string; unknown: string
  freshTint: string; soonTint: string; spoiledTint: string
  ice: string; iceBg: string; iceLine: string; iceGlass: string; iceText: string
  enamel: string; enamelEdge: string; metal: string; metalHi: string
  danger: string; dangerLight: string; warning: string; warningLight: string
}

export const palettes: { light: Palette; dark: Palette } = {
  // Light palette: warm linen neutrals (2026-09-26). Replaced values, for a quick manual revert:
  //   background #e9eee8, surface #ffffff, frost #e0e8e1, border #d7e0d9, primary #23804a,
  //   primaryLight #eef8f1, text #17251f, textSoft #4c5d55, muted #8a9a93
  //   (also raised #ffffff, unknown #8a9a93, freshTint #eef8f1, enamel #fbfcfb, enamelEdge #dde5e1;
  //   in global.css fresh-100 #d5eedc). primary, text and the freshness hues are unchanged.
  light: {
    primary: '#23804a', primaryLight: '#edf4e8',
    background: '#ece7de', surface: '#fffdf9', raised: '#fffdf9', frost: '#f5f1ea',
    text: '#17251f', textSoft: '#505750', muted: '#736f67', onInk: '#ffffff',
    border: '#e0d9cc', glass: '#cfe2db',
    fresh: '#2f9e5b', soon: '#e39a1b', spoiled: '#d9493a', unknown: '#736f67',
    freshTint: '#edf4e8', soonTint: '#fff7e8', spoiledTint: '#fdefed',
    ice: '#5b8fb9', iceBg: '#eaf3fa', iceLine: '#cfe1ef', iceGlass: '#bcd6ea', iceText: '#3f6a8f',
    enamel: '#fdfcf8', enamelEdge: '#e1dbcf', metal: '#d3dcd8', metalHi: '#ffffff',
    danger: '#d9493a', dangerLight: '#fdefed', warning: '#e39a1b', warningLight: '#fff7e8',
  },
  dark: {
    primary: '#2ea864', primaryLight: '#13271c',
    background: '#0f1513', surface: '#171e1b', raised: '#1d2522', frost: '#1e2723',
    text: '#e6eee9', textSoft: '#b1bfb8', muted: '#7f918a', onInk: '#0f1513',
    border: '#2a3530', glass: '#2f3f38',
    fresh: '#2ea864', soon: '#cf8c14', spoiled: '#e8474f', unknown: '#7f918a',
    freshTint: '#13271c', soonTint: '#2a2012', spoiledTint: '#2c1716',
    ice: '#7fb3dc', iceBg: '#14212b', iceLine: '#233a4a', iceGlass: '#2e4c60', iceText: '#a8cdea',
    enamel: '#202925', enamelEdge: '#323d38', metal: '#4a5752', metalHi: '#8a9a93',
    danger: '#e8474f', dangerLight: '#2c1716', warning: '#cf8c14', warningLight: '#2a2012',
  },
}

// For screens that use static StyleSheets (auth, household, settings, camera). On web these
// are CSS variables, so those screens follow the light/dark switch with no code changes;
// on native they're the light values.
const v = (name: string, fallback: string) => (Platform.OS === 'web' ? `var(--color-${name}, ${fallback})` : fallback)
const L = palettes.light
export const colors = {
  primary: v('fresh-600', L.primary),
  primaryLight: v('fresh-50', L.primaryLight),
  background: v('paper', L.background),
  surface: v('surface', L.surface),
  text: v('ink', L.text),
  muted: v('mute', L.muted),
  border: v('line', L.border),
  danger: v('spoiled-500', L.danger),
  dangerLight: v('spoiled-50', L.dangerLight),
  warning: v('soon-500', L.warning),
  warningLight: v('soon-50', L.warningLight),
}

// One depth scale for the whole app, so cards feel like the same material everywhere.
export const shadow = {
  /** Resting cards and panels. */
  card: { shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  /** Things that float: tooltips, toasts, the fridge cabinet. */
  raised: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
}

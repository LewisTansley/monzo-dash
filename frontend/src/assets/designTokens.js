/**
 * Hex mirror of design-tokens.css for <script>, canvas, and inline SVG.
 * Must stay in sync with ./design-tokens.css :root values.
 */
export const designTokens = {
  space: '#14141f',
  panel: '#2a2d3a',
  panelRaised: '#353846',
  panelInset: '#1a1d24',
  void: '#0f1114',
  border: '#3d4252',
  borderStrong: '#4a5063',

  blueMuted: '#69739c',
  blueBright: '#66a3ff',
  blueMid: '#4466cc',
  blueDeep: '#2244aa',
  blueSpace: '#1a1a2e',
  blueVoid: '#0f0f1a',

  accentGreen: '#72db72',
  accentOrange: '#d9a84a',
  accentOrangeSoft: '#b8935a',

  textPrimary: '#e5e7eb',
  textSecondary: '#a0aec0',
  textMuted: '#6b7280',
  textTertiary: '#d1d5db',
  textDisabled: '#9ca3af',
  white: '#ffffff',
  black: '#000000',

  danger: '#dc2626',
  dangerSoft: '#f87171',
  warning: '#f59e0b',
  success: '#72db72',
  info: '#69739c',

  accentGreenRgb: '114, 219, 114',
  blueMutedRgb: '105, 115, 156',
  accentOrangeRgb: '217, 168, 74',
  dangerRgb: '220, 38, 38',
  warningRgb: '245, 158, 11',

  appletGap: '12px',
  appletPadding: '12px',
  pageEdgeInset: '16px',
  contentMaxWidth: '960px',
  appletSegmentedBg: '#1e1e2e',
  chromeRadiusOuter: '20px',
  chromeRadiusInner: '8px',
  sidebarRailWidth: '300px',
  appletRailGutterWidth: '22px',
  sidebarPanelMax: '300px',
  /** Sync with --sw-sidebar-interactable-padding */
  sidebarInteractablePadding: '8px',
  /** Cumulative sidebar surface dim; sync with --sw-sidebar-stack-overlay */
  sidebarStackOverlay: '#00000020',
  edgeHitSensorWidth: '12px',
  edgeRevealPeek: '36px',

  /** Pixels; keep in sync with --sw-titlebar-height in design-tokens.css */
  titlebarHeightPx: 80,

  appCanvas: '#181825',
  tabInactiveBg: '#00000010',
  tabActiveBg: '#00000020'
}

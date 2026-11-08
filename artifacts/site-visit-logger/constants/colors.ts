/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Both light and dark palettes provide high-contrast, accessible token sets
 * tuned for both client (Hiring) and technician (Working) workflows.
 * The dark palette uses true AMOLED pitch-black (#000000) for deepest contrast,
 * zero backlight glow on OLED displays, and ultra-sleek appearance.
 */

const colors = {
  light: {
    text: '#111827',
    tint: '#f97316',

    background: '#f8fafc',
    foreground: '#111827',

    card: '#ffffff',
    cardForeground: '#111827',

    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#fff7ed',
    secondaryForeground: '#c2410c',

    muted: '#f1f5f9',
    mutedForeground: '#6b7280',

    accent: '#ffedd5',
    accentForeground: '#c2410c',

    destructive: '#dc2626',
    destructiveForeground: '#ffffff',

    // Status colors from the Fundi design spec. Used for job status badges,
    // timelines, and money rows. Never rely on these alone to convey state —
    // always pair them with a label or icon.
    success: '#16a34a',
    successForeground: '#ffffff',
    successMuted: '#dcfce7',

    warning: '#f59e0b',
    warningMuted: '#fef3c7',
    // Amber text on warningMuted; plain warning is too light to read on it.
    warningForeground: '#92400e',

    destructiveMuted: '#fee2e2',

    info: '#2563eb',
    infoMuted: '#dbeafe',

    border: '#e5e7eb',
    input: '#d1d5db',
  },

  dark: {
    // Pure high-contrast crisp text
    text: '#ffffff',
    tint: '#f97316',

    // True AMOLED Pitch Black: zero glow, complete pixel shutoff on OLED
    background: '#000000',
    foreground: '#ffffff',

    // Deepest dark surface elevation (true pitch dark cards)
    card: '#0c0c0e',
    cardForeground: '#ffffff',

    // Fundi brand primary orange
    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#181008',
    secondaryForeground: '#fb923c',

    // Deep dark neutral layer
    muted: '#121214',
    mutedForeground: '#7a7a85',

    accent: '#221307',
    accentForeground: '#fdba74',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    success: '#22c55e',
    successForeground: '#ffffff',
    successMuted: '#05180c',

    warning: '#f59e0b',
    warningMuted: '#1a1002',
    warningForeground: '#fcd34d',

    destructiveMuted: '#1c0507',

    info: '#3b82f6',
    infoMuted: '#06101e',

    // Ultra-subtle dark borders that don't wash out or lighten the screen
    border: '#1c1c1f',
    input: '#161618',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export type ColorTheme = typeof colors.light;
export default colors;

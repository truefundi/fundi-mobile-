/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Both light and dark palettes provide high-contrast, accessible token sets
 * tuned for both client (Hiring) and technician (Working) workflows.
 * - Light mode: Ultra-bright, clean white canvas (#ffffff) with crisp slate typography.
 * - Dark mode: Deep Antigravity matte dark canvas (#070a0f / #0f141c) with crystal-clear white text.
 */

const colors = {
  light: {
    text: '#0f172a',
    tint: '#f97316',

    background: '#ffffff',
    foreground: '#0f172a',

    card: '#ffffff',
    cardForeground: '#0f172a',

    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#fff7ed',
    secondaryForeground: '#c2410c',

    muted: '#f8fafc',
    mutedForeground: '#64748b',

    accent: '#ffedd5',
    accentForeground: '#c2410c',

    destructive: '#dc2626',
    destructiveForeground: '#ffffff',

    success: '#16a34a',
    successForeground: '#ffffff',
    successMuted: '#dcfce7',

    warning: '#f59e0b',
    warningMuted: '#fef3c7',
    warningForeground: '#92400e',

    destructiveMuted: '#fee2e2',

    info: '#2563eb',
    infoMuted: '#dbeafe',

    border: '#e2e8f0',
    input: '#cbd5e1',
  },

  dark: {
    // Pure high-contrast crisp text (bright and easy to read)
    text: '#ffffff',
    tint: '#f97316',

    // Deep Antigravity matte dark canvas
    background: '#070a0f',
    foreground: '#ffffff',

    // Sleek dark surface elevation
    card: '#0f141c',
    cardForeground: '#ffffff',

    // Fundi brand primary orange
    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#1c1208',
    secondaryForeground: '#fb923c',

    // Deep dark neutral layer
    muted: '#131924',
    mutedForeground: '#94a3b8',

    accent: '#261609',
    accentForeground: '#fdba74',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    success: '#22c55e',
    successForeground: '#ffffff',
    successMuted: '#061a0d',

    warning: '#f59e0b',
    warningMuted: '#1a1002',
    warningForeground: '#fcd34d',

    destructiveMuted: '#1c0507',

    info: '#3b82f6',
    infoMuted: '#0b1626',

    // Sleek dark borders
    border: '#1b2230',
    input: '#121824',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export type ColorTheme = typeof colors.light;
export default colors;

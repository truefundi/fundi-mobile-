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
    text: '#0f172a',
    tint: '#f97316',

    // Ultra-bright pure white canvas
    background: '#ffffff',
    foreground: '#0f172a',

    // Crisp white card surface
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

    border: '#e2e8f0',
    input: '#cbd5e1',
  },

  dark: {
    // High-contrast, eye-friendly soft off-white text (no blinding glare)
    text: '#e4e4e7',
    tint: '#f97316',

    // True pitch-black canvas: comfortable dark mode, zero backlight glow
    background: '#000000',
    foreground: '#e4e4e7',

    // Sleek true-dark card elevation
    card: '#0a0a0a',
    cardForeground: '#e4e4e7',

    // Fundi brand primary orange
    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#181108',
    secondaryForeground: '#f97316',

    // Subdued neutral dark layers
    muted: '#121212',
    mutedForeground: '#71717a',

    accent: '#231408',
    accentForeground: '#fb923c',

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
    infoMuted: '#06101e',

    // Subtle dark borders and inputs
    border: '#1c1c1c',
    input: '#121212',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export type ColorTheme = typeof colors.light;
export default colors;

/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
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

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export default colors;

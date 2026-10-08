/**
 * Deterministic browser-safe War Chess editorial typography.
 *
 * Major titles use a high-contrast editorial serif. Small labels and body copy
 * use a restrained condensed sans. Decorative rules, boxed-title accents, and
 * sequence fractions such as `01 / 03` are not part of this text system.
 * Functional connectors, map paths, and evidence relationships remain allowed.
 */
export const WC_EDITORIAL_SERIF = "Georgia, 'Times New Roman', serif";

export const WC_EDITORIAL_SANS = "'Arial Narrow', Arial, sans-serif";

export const WC_EDITORIAL_TEXT = {
  title: {
    fontFamily: WC_EDITORIAL_SERIF,
    fontWeight: 700,
    letterSpacing: -1.2,
  },
  label: {
    fontFamily: WC_EDITORIAL_SANS,
    fontWeight: 700,
    letterSpacing: 4,
  },
  body: {
    fontFamily: WC_EDITORIAL_SANS,
    fontWeight: 500,
    letterSpacing: 0.7,
  },
} as const;

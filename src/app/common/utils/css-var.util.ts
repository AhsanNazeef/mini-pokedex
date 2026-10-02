/**
 * Reads a CSS custom property from :root, e.g. "--type-fire" → "#ee8130".
 * Returns "" when it is not defined or there is no DOM.
 */
export function readCssVariable(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

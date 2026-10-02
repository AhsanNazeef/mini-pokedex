/** Turns a hyphenated API name into display text: "mr-mime" → "Mr Mime". */
export function toTitleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

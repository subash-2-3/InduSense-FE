/** Up to two initials for an avatar: `Plant Admin` -> `PA`, `admin@indusense.com` -> `A`. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase());
  return (letters.length > 1 ? letters[0] + letters[letters.length - 1] : letters[0]) ?? '?';
}

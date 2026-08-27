/**
 * Vietnamese-aware slugging, shared by the admin editors (client-side
 * suggestion as the title is typed) and the server actions (authoritative
 * value). Deliberately dependency-free and isomorphic.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

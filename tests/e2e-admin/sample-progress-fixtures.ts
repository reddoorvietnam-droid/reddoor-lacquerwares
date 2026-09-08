// Shared between the spec and the cleanup script. Deliberately free of any
// import: the spec runs in the Playwright process, where pulling in
// "server-only" (via the database modules) would fail to load.

/** Weeks far enough in the future that no real report can ever land on them. */
export const fixtureWeeks = [
  "2098-01-06",
  "2098-01-13",
  "2098-01-20",
] as const;

/** Every fixture sample carries this marker in its order name. */
export const fixtureMarker = "E2E mẫu tiến độ";

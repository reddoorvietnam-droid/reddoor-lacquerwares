import "server-only";

import { cache } from "react";

import { ContentAccessDeniedError, requireListAccess } from "@/lib/auth";

/**
 * Whether the reader has an inbox of assigned work to open.
 *
 * Every role but the Director holds `tasks.read` at `own`, and an `own`
 * grant deliberately opens no list screen — `resolvePermissionCoverages`
 * reports neither a global nor a unit coverage for it, so the sidebar's own
 * filter would hide the entry. The personal task list is the one screen an
 * `own` grant is supposed to open, so it asks the list guard directly.
 */
export const canSeeAssignedTasks = cache(async (): Promise<boolean> => {
  try {
    // The same guard the page itself runs, so the entry appears exactly when
    // the screen behind it opens — including for a unit-bound `own` grant,
    // whose target is the units that grant is bound to.
    await requireListAccess("tasks.read");
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
});

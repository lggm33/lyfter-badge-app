/** A rule the user can fix: form actions return its message instead of sending them to the error page. */
export class ActionError extends Error {}

export type ActionState = { error?: string } | null;

/** Postgres unique_violation, raw or wrapped by Drizzle. */
export function isUniqueViolation(error: unknown) {
  const cause = error as { code?: string; cause?: { code?: string } };
  return cause.code === "23505" || cause.cause?.code === "23505";
}

/** Runs a form mutation and turns user-fixable failures into form state; anything else still throws. */
export async function formResult(run: () => Promise<unknown>, uniqueMessage: string): Promise<ActionState> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    if (isUniqueViolation(error)) return { error: uniqueMessage };
    throw error;
  }
}

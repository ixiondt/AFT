export { auth, handlers, signIn, signOut } from "./config";
export { getAuthAndUser, requireAdmin, isOwnerEmail } from "./admin";
export {
  decideUnitAccess,
  getUnitContext,
  requireUnitAccess,
  isUnitOwner,
  listUnitsForUser,
  type UnitRole,
} from "./units";

import { auth } from "./config";

/** Require an authenticated session on a server component/route. Throws to surface a 401. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Response(
      JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          retryable: false,
        },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  return session;
}

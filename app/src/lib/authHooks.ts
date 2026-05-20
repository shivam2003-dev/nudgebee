// Auth-flow extension hooks. OSS code provides default no-op
// implementations; EE registers real impls in app/src/ee/auth/superAdmin.ts
// at module-init time (via @ee/init blank-import in _app.tsx).
//
// Hooks here intentionally manipulate plain shapes (token, role list) rather
// than encapsulating super-admin specifics. The data fields (token.isSuperAdmin,
// the 'super_admin' role string) live in the OSS type system; only the
// *production rules* are EE-side.

type TokenEnricher = (token: Record<string, unknown>, userId: string) => Promise<void>;
type RoleElevator = (userRoles: string[], jwt: Record<string, unknown>) => string[];

let _enricher: TokenEnricher = async () => {};
let _elevator: RoleElevator = (roles) => roles;

export function registerTokenEnricher(h: TokenEnricher): void {
  _enricher = h;
}

export function registerRoleElevator(h: RoleElevator): void {
  _elevator = h;
}

/**
 * Augments a NextAuth JWT with deployment-specific claims after the user is
 * resolved. OSS impl is a no-op; EE impl looks up the super-admin role from
 * user_role and sets token.isSuperAdmin / isSuperAdminReadonly + grants
 * cross-tenant access.
 */
export async function enrichAuthToken(token: Record<string, unknown>, userId: string): Promise<void> {
  await _enricher(token, userId);
}

/**
 * Expands a request's allowed-role set based on JWT claims. OSS impl returns
 * roles unchanged; EE impl appends 'super_admin' when the JWT carries the
 * corresponding claim. Used by rpcGateway when forwarding Hasura actions.
 */
export function elevateRoles(userRoles: string[], jwt: Record<string, unknown>): string[] {
  return _elevator(userRoles, jwt);
}

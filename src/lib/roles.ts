export type Role = 'ADMIN' | 'TECH' | 'READONLY';

/** TECH and ADMIN can change data (resolve issues, edit prospects, import CSV). */
export function canEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'TECH';
}

/** Only ADMIN can manage users and run syncs. */
export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

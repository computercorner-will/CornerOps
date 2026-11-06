import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { hasRole, type Role } from '@/lib/roles';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/** The signed-in user with their current role from the database (once per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
  return user;
});

/** For pages: redirects to sign-in when there is no valid user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super('You do not have permission to do that.');
    this.name = 'ForbiddenError';
  }
}

/** For server actions and admin pages: throws unless the user has one of the roles. */
export async function requireRole(allowed: readonly Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.role, allowed)) throw new ForbiddenError();
  return user;
}

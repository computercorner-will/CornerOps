import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { env } from '@/env';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';

/**
 * Auth.js with Microsoft Entra ID only (no passwords, no other providers).
 * Single-tenant: the issuer is pinned to our tenant, and the `tid` claim is checked again
 * on every sign-in as defense in depth.
 * Roles live in our database (User.role) and are read fresh on each request, so a role
 * change applies immediately; the session JWT only carries the user's id.
 */

const tenantId = env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  // Needed behind a reverse proxy on a VM; Vercel sets this automatically.
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/signin', error: '/signin' },
  providers: [
    MicrosoftEntraID({
      clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    }),
  ],
  callbacks: {
    // Protects every route matched by src/proxy.ts.
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },

    async signIn({ profile }) {
      if (!profile || profile.tid !== tenantId) return false;
      const email = emailFromProfile(profile);
      if (!email) return false;

      const isBootstrapAdmin = env.ADMIN_EMAILS.includes(email);
      const existing = await db.user.findUnique({ where: { email } });

      if (!existing) {
        const user = await db.user.create({
          data: {
            email,
            name: profile.name ?? null,
            role: isBootstrapAdmin ? 'ADMIN' : 'READONLY',
          },
        });
        await writeAudit({
          userId: user.id,
          action: 'user.created',
          entity: 'User',
          entityId: user.id,
          after: { email: user.email, role: user.role },
        });
      } else if (isBootstrapAdmin && existing.role !== 'ADMIN') {
        await db.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
        await writeAudit({
          userId: existing.id,
          action: 'user.role.bootstrap',
          entity: 'User',
          entityId: existing.id,
          before: { role: existing.role },
          after: { role: 'ADMIN', reason: 'Listed in ADMIN_EMAILS' },
        });
      }
      return true;
    },

    async jwt({ token, profile }) {
      // `profile` is only present right after sign-in.
      if (profile) {
        const email = emailFromProfile(profile);
        const user = email ? await db.user.findUnique({ where: { email } }) : null;
        token.uid = user?.id;
        token.email = email;
      }
      return token;
    },

    session({ session, token }) {
      if (typeof token.uid === 'string') session.user.id = token.uid;
      return session;
    },
  },
});

function emailFromProfile(profile: { email?: string | null; [key: string]: unknown }) {
  const raw = profile.email ?? profile.preferred_username;
  return typeof raw === 'string' && raw.includes('@') ? raw.trim().toLowerCase() : null;
}

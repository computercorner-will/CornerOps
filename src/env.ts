import { z } from 'zod';

/**
 * Server-side environment variables, validated once at startup.
 * Never import this module from a client component: it holds secrets.
 * Error messages list variable names only, never their values.
 */

const emailList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Auth.js
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1),
    AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1),
    // A tenant GUID (not "common"/"organizations"), which restricts sign-in to our tenant.
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: z.guid('Must be your Entra tenant ID (a GUID)'),
    ADMIN_EMAILS: emailList,

    // Integrations
    INTEGRATIONS_MODE: z.enum(['mock', 'live']).default('mock'),
    SYNCRO_BASE_URL: optionalString.pipe(z.url().optional()),
    SYNCRO_API_KEY: optionalString,
    PAX8_CLIENT_ID: optionalString,
    PAX8_CLIENT_SECRET: optionalString,

    // Reconciliation
    PRICE_FLOOR_PER_DEVICE_CENTS: z.coerce.number().int().positive().default(7500),
  })
  .superRefine((value, ctx) => {
    if (value.INTEGRATIONS_MODE !== 'live') return;
    const requiredInLive = [
      'SYNCRO_BASE_URL',
      'SYNCRO_API_KEY',
      'PAX8_CLIENT_ID',
      'PAX8_CLIENT_SECRET',
    ] as const;
    for (const key of requiredInLive) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when INTEGRATIONS_MODE=live`,
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${problems}\nSee .env.example for every variable.`,
    );
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);

import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  AccessDenied: 'Your account is not allowed to sign in. Use your work account.',
  Configuration: 'Sign-in is not configured correctly. Contact an administrator.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect('/');
  const { error } = await searchParams;

  async function signInWithMicrosoft() {
    'use server';
    await signIn('microsoft-entra-id', { redirectTo: '/' });
  }

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CornerOps</CardTitle>
          <CardDescription>Sign in with your work account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {errorMessages[error] ?? 'Sign-in failed. Please try again.'}
            </p>
          )}
          <form action={signInWithMicrosoft}>
            <Button type="submit" className="w-full" size="lg">
              Sign in with Microsoft
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

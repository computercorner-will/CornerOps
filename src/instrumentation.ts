// Runs once when the server starts: fail fast on a bad environment configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./env');
  }
}

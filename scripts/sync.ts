/**
 * `pnpm sync`: pulls Syncro and Pax8 data into the database (mock or live, per
 * INTEGRATIONS_MODE) and reruns reconciliation. Audit entries have userId = null (system).
 */
import 'dotenv/config';

async function main() {
  // Imported after dotenv so env validation sees the .env values.
  const { runSync } = await import('../src/sync/run-sync');
  const { db } = await import('../src/lib/db');

  try {
    const result = await runSync(null);
    console.info(`Sync finished (mode: ${result.mode})`);
    for (const source of result.sources) {
      console.info(
        `  ${source.source}: ${source.status}, ${source.recordsRead} records` +
          (source.error ? ` - ${source.error}` : ''),
      );
    }
    if (result.reconciliation) {
      const r = result.reconciliation;
      console.info(
        `  Reconciliation: ${r.created} new, ${r.updated} updated, ${r.autoResolved} auto-resolved`,
      );
    }
    if (result.sources.some((s) => s.status === 'FAILED')) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

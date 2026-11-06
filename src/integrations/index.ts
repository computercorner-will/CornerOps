import { env } from '@/env';
import { MockGraphClient } from './graph/mock';
import type { GraphClient } from './graph/types';
import { LivePax8Client } from './pax8/live';
import { MockPax8Client } from './pax8/mock';
import type { Pax8Client } from './pax8/types';
import { LiveSyncroClient } from './syncro/live';
import { MockSyncroClient } from './syncro/mock';
import type { SyncroClient } from './syncro/types';

/**
 * Server-side only. Used by the sync job (`pnpm sync` and the admin "Run sync" button);
 * never import from a client component.
 */
export interface Integrations {
  mode: 'mock' | 'live';
  syncro: SyncroClient;
  pax8: Pax8Client;
  graph: GraphClient;
}

/** Picks mock or live clients based on INTEGRATIONS_MODE (default: mock). */
export function getIntegrations(): Integrations {
  if (env.INTEGRATIONS_MODE === 'live') {
    // env.ts guarantees these are present in live mode.
    return {
      mode: 'live',
      syncro: new LiveSyncroClient(env.SYNCRO_BASE_URL!, env.SYNCRO_API_KEY!),
      pax8: new LivePax8Client(env.PAX8_CLIENT_ID!, env.PAX8_CLIENT_SECRET!),
      // Graph has no live implementation in v1.
      graph: new MockGraphClient(),
    };
  }
  return {
    mode: 'mock',
    syncro: new MockSyncroClient(),
    pax8: new MockPax8Client(),
    graph: new MockGraphClient(),
  };
}

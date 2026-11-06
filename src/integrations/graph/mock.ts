import users from './fixtures/users.json';
import type { GraphClient, GraphUser } from './types';

/** Mock Graph client backed by JSON fixtures. Returns the same fake users for any tenant. */
export class MockGraphClient implements GraphClient {
  async listUsers(tenantId: string): Promise<GraphUser[]> {
    void tenantId;
    return users.users.map((user) => ({ ...user }));
  }
}

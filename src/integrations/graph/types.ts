/**
 * Microsoft Graph integration (placeholder for the Onboarding/Offboarding module).
 * Interface and mock only in v1; there is no live implementation yet.
 */

export interface GraphUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
  accountEnabled: boolean;
  assignedLicenseSkus: string[];
}

/** Read-only for now. Onboarding writes will need their own review before being added. */
export interface GraphClient {
  listUsers(tenantId: string): Promise<GraphUser[]>;
}

import { describe, expect, it } from 'vitest';
import { canEdit, hasRole, isAdmin } from './roles';

describe('roles', () => {
  it('lets TECH and ADMIN edit, but not READONLY', () => {
    expect(canEdit('ADMIN')).toBe(true);
    expect(canEdit('TECH')).toBe(true);
    expect(canEdit('READONLY')).toBe(false);
  });

  it('only treats ADMIN as admin', () => {
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('TECH')).toBe(false);
    expect(isAdmin('READONLY')).toBe(false);
  });

  it('checks membership in an allowed list', () => {
    expect(hasRole('TECH', ['ADMIN', 'TECH'])).toBe(true);
    expect(hasRole('READONLY', ['ADMIN', 'TECH'])).toBe(false);
  });
});

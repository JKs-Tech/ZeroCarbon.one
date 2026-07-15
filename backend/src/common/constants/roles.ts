/**
 * Application roles for RBAC.
 * Phase 3 assignment roles only — ADMIN and USER.
 */
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type RoleValue = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: RoleValue[] = [Role.ADMIN, Role.USER];

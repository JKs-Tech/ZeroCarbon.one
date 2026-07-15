/**
 * Audit actions for human review trail (append-only).
 */
export const AuditAction = {
  EDIT: 'EDIT',
  APPROVED: 'APPROVED',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

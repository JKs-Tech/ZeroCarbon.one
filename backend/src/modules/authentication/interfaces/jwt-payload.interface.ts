import type { RoleValue } from '../../../common/constants';

/**
 * JWT access-token payload shape.
 */
export interface JwtPayload {
  /** User ID (subject). */
  sub: string;
  email: string;
  role: RoleValue;
  iat?: number;
  exp?: number;
}

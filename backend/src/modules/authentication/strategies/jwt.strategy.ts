import jwt from 'jsonwebtoken';
import type { ConfigService } from '../../config';
import type { RoleValue } from '../../../common/constants';
import { UnauthorizedException } from '../../../common/exceptions';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Responsibility: Sign and verify JWTs.
 * Isolated so AuthService never depends on jsonwebtoken beyond this strategy.
 */
export class JwtStrategy {
  public constructor(private readonly config: ConfigService) {}

  /**
   * Creates a signed access token for an authenticated user.
   */
  public sign(input: { userId: string; email: string; role: RoleValue }): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: input.userId,
      email: input.email,
      role: input.role,
    };

    return jwt.sign(payload, this.config.security.jwtSecret, {
      expiresIn: this.config.security.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Verifies a JWT and returns the typed payload.
   * Rejects invalid and expired tokens with UnauthorizedException.
   */
  public verify(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.security.jwtSecret);

      if (typeof decoded === 'string' || !decoded.sub || !decoded.email || !decoded.role) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        sub: String(decoded.sub),
        email: String(decoded.email),
        role: decoded.role as RoleValue,
        iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
        exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }

      throw new UnauthorizedException('Invalid token');
    }
  }
}

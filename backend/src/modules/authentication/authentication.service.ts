import type { LoggerService } from '../logger';
import type { UsersService } from '../users';
import type { PublicUser } from '../users/schemas/user.schema';
import { UnauthorizedException } from '../../common/exceptions';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import { JwtStrategy } from './strategies/jwt.strategy';

export interface AuthTokenResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

/**
 * Responsibility: Registration, login, and profile orchestration.
 * Does not call Mongo or JWT libraries directly — uses UsersService + JwtStrategy.
 */
export class AuthenticationService {
  public constructor(
    private readonly usersService: UsersService,
    private readonly jwtStrategy: JwtStrategy,
    private readonly logger: LoggerService,
    private readonly jwtExpiresIn: string,
  ) {}

  /**
   * Registers a new user and returns a JWT session.
   */
  public async register(input: RegisterDto): Promise<AuthTokenResult> {
    const user = await this.usersService.createUser(input);

    this.logger.info('User registration succeeded', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return this.issueToken(user);
  }

  /**
   * Authenticates credentials and returns a JWT.
   * Uses a generic error so email/password existence is not revealed.
   */
  public async login(input: LoginDto): Promise<AuthTokenResult> {
    const user = await this.usersService.findByEmailForAuth(input.email);

    if (!user || !user.passwordHash) {
      this.logger.warn('Login failed', { email: input.email, reason: 'user_not_found' });
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.usersService.verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      this.logger.warn('Login failed', { email: input.email, reason: 'invalid_password' });
      throw new UnauthorizedException('Invalid email or password');
    }

    const publicUser = this.usersService.toPublicUser(user);

    this.logger.info('Login succeeded', {
      userId: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    });

    return this.issueToken(publicUser);
  }

  /**
   * Returns the profile for an authenticated user id.
   */
  public async getProfile(userId: string): Promise<PublicUser> {
    return this.usersService.getById(userId);
  }

  private issueToken(user: PublicUser): AuthTokenResult {
    const accessToken = this.jwtStrategy.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.jwtExpiresIn,
    };
  }
}

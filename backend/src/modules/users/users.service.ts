import bcrypt from 'bcrypt';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import { Role, type RoleValue } from '../../common/constants';
import { ConflictException, ForbiddenException, NotFoundException } from '../../common/exceptions';
import { buildPaginationMeta, parsePagination, toSkipTake } from '../../common/utils';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { PublicUser, UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

/**
 * Responsibility: User domain operations — creation, lookup, roles, profiles.
 * Password hashing lives here; plain passwords are never logged or returned.
 */
export class UsersService {
  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Creates a user with a bcrypt password hash.
   * First registered user becomes ADMIN (bootstrap); subsequent users are USER.
   */
  public async createUser(input: CreateUserDto): Promise<PublicUser> {
    const existing = await this.usersRepository.findByEmail(input.email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const userCount = await this.usersRepository.count();
    const role: RoleValue = userCount === 0 ? Role.ADMIN : Role.USER;

    const passwordHash = await bcrypt.hash(
      input.password,
      this.config.security.bcryptSaltRounds,
    );

    try {
      const user = await this.usersRepository.create({
        name: input.name,
        email: input.email,
        passwordHash,
        role,
      });

      this.logger.info('User created', {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return this.usersRepository.toPublic(user);
    } catch (error) {
      if (isMongoDuplicateKey(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  /**
   * Returns a public user profile by id.
   */
  public async getById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersRepository.toPublic(user);
  }

  /**
   * Finds a user by email including passwordHash for credential verification.
   */
  public async findByEmailForAuth(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email, { includePasswordHash: true });
  }

  /**
   * Maps a persisted user document to the public API shape.
   */
  public toPublicUser(user: UserDocument): PublicUser {
    return this.usersRepository.toPublic(user);
  }

  /**
   * Compares a plaintext password against a stored hash.
   */
  public async verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  /**
   * Lists users (ADMIN manage-users capability).
   */
  public async listUsers(pageRaw: unknown, limitRaw: unknown): Promise<{
    users: PublicUser[];
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const pagination = parsePagination(pageRaw, limitRaw);
    const { skip, limit } = toSkipTake(pagination);
    const [users, total] = await Promise.all([
      this.usersRepository.findMany(skip, limit),
      this.usersRepository.count(),
    ]);

    return {
      users: users.map((u) => this.usersRepository.toPublic(u)),
      pagination: buildPaginationMeta(pagination, total),
    };
  }

  /**
   * Updates a user's role (ADMIN manage-users capability).
   */
  public async updateUserRole(
    actorId: string,
    targetUserId: string,
    input: UpdateUserDto,
  ): Promise<PublicUser> {
    if (actorId === targetUserId && input.role !== Role.ADMIN) {
      throw new ForbiddenException('Cannot demote your own admin account');
    }

    const updated = await this.usersRepository.updateRole(targetUserId, input.role);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    this.logger.info('User role updated', {
      actorId,
      targetUserId,
      role: input.role,
    });

    return this.usersRepository.toPublic(updated);
  }

  /**
   * Enforces that a USER may only access their own resource id.
   * ADMIN may access any resource. Reusable for future document routes.
   */
  public assertSelfOrAdmin(actor: { id: string; role: RoleValue }, resourceOwnerId: string): void {
    if (actor.role === Role.ADMIN) {
      return;
    }

    if (actor.id !== resourceOwnerId) {
      throw new ForbiddenException('You can only access your own resources');
    }
  }
}

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}

import type { RoleValue } from '../../common/constants';
import { UserModel, type UserDocument, toPublicUser, type PublicUser } from './schemas/user.schema';

export interface CreateUserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: RoleValue;
}

/**
 * Responsibility: MongoDB access for users.
 * No business rules — persistence only (Repository Pattern).
 */
export class UsersRepository {
  /**
   * Inserts a new user document.
   */
  public async create(data: CreateUserRecord): Promise<UserDocument> {
    return UserModel.create(data);
  }

  /**
   * Finds a user by email (case-normalized by schema).
   * Includes passwordHash when needed for authentication.
   */
  public async findByEmail(
    email: string,
    options: { includePasswordHash?: boolean } = {},
  ): Promise<UserDocument | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });

    if (options.includePasswordHash) {
      query.select('+passwordHash');
    }

    return query.exec();
  }

  /**
   * Finds a user by id.
   */
  public async findById(
    id: string,
    options: { includePasswordHash?: boolean } = {},
  ): Promise<UserDocument | null> {
    const query = UserModel.findById(id);

    if (options.includePasswordHash) {
      query.select('+passwordHash');
    }

    return query.exec();
  }

  /**
   * Returns total user count (used for bootstrap admin).
   */
  public async count(): Promise<number> {
    return UserModel.countDocuments().exec();
  }

  /**
   * Lists users with pagination (admin).
   */
  public async findMany(skip: number, limit: number): Promise<UserDocument[]> {
    return UserModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Updates a user's role.
   */
  public async updateRole(id: string, role: RoleValue): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
  }

  /**
   * Converts a document to a public user DTO.
   */
  public toPublic(user: UserDocument): PublicUser {
    return toPublicUser(user);
  }
}

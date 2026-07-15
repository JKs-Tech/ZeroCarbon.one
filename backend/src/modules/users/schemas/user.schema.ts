import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { Role, type RoleValue } from '../../../common/constants';

/**
 * User document fields persisted in MongoDB.
 */
export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: RoleValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for application users.
 * passwordHash is excluded from queries by default.
 */
const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: [Role.ADMIN, Role.USER],
      required: true,
      default: Role.USER,
    },
  },
  {
    timestamps: true,
    collection: 'users',
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true });

export type UserDocument = HydratedDocument<IUser>;

export type UserModelType = Model<IUser>;

export const UserModel: UserModelType = model<IUser>('User', userSchema);

/**
 * Safe user fields returned by the API (never includes passwordHash).
 */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: RoleValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Maps a Mongoose user document to a public DTO.
 */
export function toPublicUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: RoleValue;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Users module wiring (Express composition equivalent of users.module.ts).
 */
export { UsersRepository } from './users.repository';
export { UsersService } from './users.service';
export { UsersController, usersValidation } from './users.controller';
export { createUsersRouter } from './users.routes';
export { UserModel, toPublicUser } from './schemas/user.schema';
export type { PublicUser, UserDocument } from './schemas/user.schema';
export { createUserSchema } from './dto/create-user.dto';
export type { CreateUserDto } from './dto/create-user.dto';
export { updateUserSchema } from './dto/update-user.dto';
export type { UpdateUserDto } from './dto/update-user.dto';

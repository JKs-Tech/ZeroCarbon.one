/**
 * Register DTO reuses the Users create-user schema for a single validation source.
 */
export { createUserSchema as registerSchema } from '../../users/dto/create-user.dto';
export type { CreateUserDto as RegisterDto } from '../../users/dto/create-user.dto';

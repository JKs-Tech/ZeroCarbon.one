import { z } from 'zod';
import { Role } from '../../../common/constants';

/**
 * Zod schema for admin user updates (role management).
 */
export const updateUserSchema = z
  .object({
    role: z.enum([Role.ADMIN, Role.USER]),
  })
  .strict();

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

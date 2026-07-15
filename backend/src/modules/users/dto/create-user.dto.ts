import { z } from 'zod';

/**
 * Zod schema for creating a user (registration payload).
 */
export const createUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(120, 'Name must be at most 120 characters'),
    email: z
      .string()
      .trim()
      .email('Email must be valid')
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
  })
  .strict();

export type CreateUserDto = z.infer<typeof createUserSchema>;

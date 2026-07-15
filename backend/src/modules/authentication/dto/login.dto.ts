import { z } from 'zod';

/**
 * Zod schema for login credentials.
 */
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Email must be valid')
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;

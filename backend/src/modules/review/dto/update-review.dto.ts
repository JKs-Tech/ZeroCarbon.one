import { z } from 'zod';

const fieldValueSchema = z.union([z.string(), z.number(), z.null()]);

/**
 * PUT /documents/:id/review — only extracted business fields.
 */
export const updateReviewSchema = z
  .object({
    fields: z
      .record(z.string().min(1).max(200), fieldValueSchema)
      .refine((fields) => Object.keys(fields).length > 0, {
        message: 'At least one field must be provided',
      }),
  })
  .strict();

export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;

export const documentIdParamSchema = z.object({
  id: z.string().min(1, 'Document id is required'),
});

import { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Box, Button, Stack, TextField } from '@mui/material';

interface ReviewFormProps {
  fields: Record<string, string | number | null>;
  disabled?: boolean;
  isSaving?: boolean;
  onSubmit: (fields: Record<string, string | number | null>) => Promise<void>;
}

export type ReviewFormHandle = {
  getMappedValues: () => Record<string, string | number | null>;
  isDirty: boolean;
};

export const ReviewForm = forwardRef<ReviewFormHandle, ReviewFormProps>(function ReviewForm(
  { fields, disabled, isSaving, onSubmit },
  ref,
) {
  const defaultValues = useMemo(() => {
    const values: Record<string, string> = {};
    Object.entries(fields).forEach(([key, value]) => {
      values[key] = value === null || value === undefined ? '' : String(value);
    });
    return values;
  }, [fields]);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isDirty },
  } = useForm<Record<string, string>>({
    defaultValues,
    values: defaultValues,
  });

  const mapValues = (values: Record<string, string>): Record<string, string | number | null> => {
    const next: Record<string, string | number | null> = {};
    Object.entries(values).forEach(([key, value]) => {
      const original = fields[key];
      if (typeof original === 'number') {
        const parsed = value.trim() === '' ? null : Number(value);
        next[key] = Number.isFinite(parsed as number) ? (parsed as number) : value;
      } else if (value.trim() === '') {
        next[key] = null;
      } else {
        next[key] = value;
      }
    });
    return next;
  };

  useImperativeHandle(
    ref,
    () => ({
      getMappedValues: () => mapValues(getValues()),
      isDirty,
    }),
    [getValues, isDirty, fields],
  );

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(mapValues(values));
      })}
    >
      <Stack spacing={2}>
        {Object.keys(fields).map((key) => (
          <Controller
            key={key}
            name={key}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={key}
                fullWidth
                disabled={disabled || isSaving}
                inputProps={{ 'aria-label': key }}
              />
            )}
          />
        ))}
        <Button type="submit" variant="contained" disabled={disabled || isSaving || !isDirty}>
          {isSaving ? 'Saving…' : 'Save fields'}
        </Button>
      </Stack>
    </Box>
  );
});

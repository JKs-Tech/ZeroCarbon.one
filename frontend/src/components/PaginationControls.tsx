import { Pagination, Stack, Typography } from '@mui/material';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onChange,
  disabled,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <Typography variant="caption" color="text.secondary">
        Showing {total} item{total === 1 ? '' : 's'}
      </Typography>
    ) : null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems="center"
      justifyContent="space-between"
      sx={{ pt: 1 }}
    >
      <Typography variant="caption" color="text.secondary">
        Showing {from}–{to} of {total}
      </Typography>
      <Pagination
        page={page}
        count={totalPages}
        onChange={(_, next) => onChange(next)}
        color="primary"
        shape="rounded"
        disabled={disabled}
        siblingCount={1}
        boundaryCount={1}
      />
    </Stack>
  );
}

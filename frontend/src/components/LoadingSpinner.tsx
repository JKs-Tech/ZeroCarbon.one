import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
      <CircularProgress aria-label={label} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}

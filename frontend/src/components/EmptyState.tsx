import { Box, Typography } from '@mui/material';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Box py={6} textAlign="center">
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary">{description}</Typography>
      ) : null}
    </Box>
  );
}

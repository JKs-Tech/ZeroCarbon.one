import { Alert, Box, Button } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ErrorState({ message, onRetry, children }: Props) {
  return (
    <Box py={2}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {message}
      </Alert>
      {children}
    </Box>
  );
}

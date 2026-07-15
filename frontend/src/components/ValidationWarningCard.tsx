import { Alert, AlertTitle, Stack } from '@mui/material';
import type { ValidationWarning } from '../types/api';

const severityMap = {
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'info',
} as const;

export function ValidationWarningCard({ warnings }: { warnings: ValidationWarning[] }) {
  if (!warnings.length) {
    return <Alert severity="success">No validation warnings.</Alert>;
  }

  return (
    <Stack spacing={1}>
      {warnings.map((warning) => (
        <Alert
          key={`${warning.code}-${warning.field ?? ''}-${warning.message}`}
          severity={severityMap[warning.severity] ?? 'warning'}
        >
          <AlertTitle>
            {warning.code} ({warning.severity})
          </AlertTitle>
          {warning.message}
          {warning.field ? ` — Field: ${warning.field}` : null}
        </Alert>
      ))}
    </Stack>
  );
}

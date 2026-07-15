import { Chip } from '@mui/material';
import { memo } from 'react';
import { DocumentProcessingStatus } from '../constants';
import { statusLabel } from '../utils/document-status';

const colorMap: Record<
  string,
  'default' | 'info' | 'warning' | 'success' | 'error' | 'primary'
> = {
  [DocumentProcessingStatus.UPLOADED]: 'default',
  [DocumentProcessingStatus.QUEUED]: 'info',
  [DocumentProcessingStatus.PROCESSING]: 'info',
  [DocumentProcessingStatus.OCR_PROCESSING]: 'info',
  [DocumentProcessingStatus.OCR_COMPLETED]: 'primary',
  [DocumentProcessingStatus.AI_PROCESSING]: 'info',
  [DocumentProcessingStatus.AI_COMPLETED]: 'primary',
  [DocumentProcessingStatus.VALIDATING]: 'info',
  [DocumentProcessingStatus.VALIDATION_COMPLETED]: 'primary',
  [DocumentProcessingStatus.WAITING_FOR_REVIEW]: 'warning',
  [DocumentProcessingStatus.APPROVED]: 'success',
  [DocumentProcessingStatus.FAILED]: 'error',
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const isLive =
    status !== DocumentProcessingStatus.WAITING_FOR_REVIEW &&
    status !== DocumentProcessingStatus.APPROVED &&
    status !== DocumentProcessingStatus.FAILED;

  const label = statusLabel(status);

  return (
    <Chip
      size="small"
      label={label}
      title={label}
      color={colorMap[status] ?? 'default'}
      variant={isLive ? 'filled' : 'outlined'}
      sx={
        isLive
          ? {
              animation: 'zcPulse 1.6s ease-in-out infinite',
              '@keyframes zcPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.72 },
              },
            }
          : undefined
      }
    />
  );
});

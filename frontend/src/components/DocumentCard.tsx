import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { DocumentProcessingStatus } from '../constants';
import type { DocumentSummary } from '../types/api';
import {
  isProcessingStatus,
  pipelineProgress,
  statusLabel,
} from '../utils/document-status';

interface DocumentCardProps {
  document: DocumentSummary;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const canReview =
    document.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW;
  const processing = isProcessingStatus(document.processingStatus);
  const failed = document.processingStatus === DocumentProcessingStatus.FAILED;
  const progress = pipelineProgress(document.processingStatus);
  const vendor =
    document.vendor?.name ?? document.extraction?.vendor ?? null;
  const docType =
    document.classification?.documentType ??
    document.extraction?.documentType ??
    null;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: failed
          ? 'error.light'
          : canReview
            ? 'warning.light'
            : 'divider',
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1.25}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            gap={1}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                wordBreak: 'break-word',
                lineHeight: 1.35,
              }}
            >
              {document.originalFileName}
            </Typography>
            <StatusBadge status={document.processingStatus} />
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {new Date(document.uploadTimestamp || document.createdAt).toLocaleString()}
          </Typography>

          {docType || vendor ? (
            <Typography variant="body2" color="text.secondary">
              {[docType, vendor].filter(Boolean).join(' · ')}
            </Typography>
          ) : null}

          {failed && document.failureReason ? (
            <Typography variant="body2" color="error.main" sx={{ fontSize: 13 }}>
              {document.failureReason.length > 120
                ? `${document.failureReason.slice(0, 120)}…`
                : document.failureReason}
            </Typography>
          ) : null}

          {document.approval?.approved ? (
            <Typography variant="body2" color="success.main">
              Approved
            </Typography>
          ) : null}

          {processing || canReview ? (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {processing
                    ? `Pipeline · ${statusLabel(document.processingStatus)}`
                    : 'Ready for human review'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {progress}%
                </Typography>
              </Stack>
              <LinearProgress
                variant={processing ? 'indeterminate' : 'determinate'}
                value={processing ? undefined : progress}
                color={canReview ? 'warning' : failed ? 'error' : 'primary'}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
          ) : null}
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
        <Button
          size="small"
          component={RouterLink}
          to={`/documents/${document.id}`}
          variant="outlined"
        >
          Details
        </Button>
        {canReview ? (
          <Button
            size="small"
            color="warning"
            variant="contained"
            component={RouterLink}
            to={`/documents/${document.id}/review`}
          >
            Review & Approve
          </Button>
        ) : null}
        {failed ? (
          <Button
            size="small"
            color="error"
            component={RouterLink}
            to={`/documents/${document.id}`}
          >
            Retry
          </Button>
        ) : null}
      </CardActions>
    </Card>
  );
}

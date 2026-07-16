import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidationWarningCard } from '../../components/ValidationWarningCard';
import { DocumentProcessingStatus, QUERY_KEYS } from '../../constants';
import { documentsApi } from '../../services/documents.api';
import { getApiErrorMessage } from '../../services/api.client';
import { isProcessingStatus } from '../../utils/document-status';

export function DocumentDetailsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.document(id),
    queryFn: () => documentsApi.getById(id),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const status = q.state.data?.processingStatus;
      return status && isProcessingStatus(status) ? 2000 : false;
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => documentsApi.reprocess(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(id) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    },
  });

  if (query.isLoading) {
    return <LoadingSpinner label="Loading document…" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const document = query.data;
  const canReview = document.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW;
  const canRetry = document.processingStatus === DocumentProcessingStatus.FAILED;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Document Details</Typography>
        <Stack direction="row" spacing={1}>
          {canRetry ? (
            <Button
              variant="contained"
              color="error"
              disabled={reprocessMutation.isPending}
              onClick={() => reprocessMutation.mutate()}
            >
              {reprocessMutation.isPending ? 'Requeueing…' : 'Retry processing'}
            </Button>
          ) : null}
          {canReview ? (
            <Button
              component={RouterLink}
              to={`/documents/${document.id}/review`}
              variant="contained"
              color="warning"
            >
              Review & Approve
            </Button>
          ) : null}
          <Button component={RouterLink} to="/dashboard" variant="outlined">
            Back
          </Button>
        </Stack>
      </Stack>

      {reprocessMutation.isError ? (
        <Alert severity="error">{getApiErrorMessage(reprocessMutation.error)}</Alert>
      ) : null}
      {reprocessMutation.isSuccess ? (
        <Alert severity="success">Requeued — worker will process OCR → AI → validation.</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Metadata
        </Typography>
        <Typography>File: {document.originalFileName}</Typography>
        <Typography>MIME: {document.mimeType}</Typography>
        <Typography>Size: {document.fileSize} bytes</Typography>
        <Stack direction="row" spacing={1} alignItems="center" mt={1}>
          <Typography>Status:</Typography>
          <StatusBadge status={document.processingStatus} />
        </Stack>
        {document.failureReason ? (
          <Typography color="error.main" mt={1}>
            Failure: {document.failureReason}
          </Typography>
        ) : null}
        {document.approval?.approved ? (
          <Typography color="success.main" mt={1}>
            Approved at {new Date(document.approval.approvedAt).toLocaleString()}
          </Typography>
        ) : (
          <Typography color="text.secondary" mt={1}>
            Not approved
          </Typography>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          OCR Result
        </Typography>
        <Typography
          component="pre"
          sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}
        >
          {(document.ocr as { text?: string } | undefined)?.text || 'OCR not available yet.'}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          AI Extraction
        </Typography>
        <Typography>
          Type: {document.classification?.documentType ?? document.extraction?.documentType ?? '—'}
        </Typography>
        <Typography>Vendor: {document.vendor?.name ?? document.extraction?.vendor ?? '—'}</Typography>
        {typeof document.extraction?.confidenceScore === 'number' ? (
          <Typography>
            Confidence: {(document.extraction.confidenceScore * 100).toFixed(0)}%
          </Typography>
        ) : null}
        <Divider sx={{ my: 1 }} />
        <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          {JSON.stringify(document.extraction?.fields ?? {}, null, 2)}
        </Typography>
        {document.extraction?.originalFields ? (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Original AI extraction (preserved)
            </Typography>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
              {JSON.stringify(document.extraction.originalFields, null, 2)}
            </Typography>
          </>
        ) : null}
      </Paper>

      {document.approval?.approved && document.approvedFields ? (
        <Paper variant="outlined" sx={{ p: 2, borderColor: 'success.light' }}>
          <Typography variant="h6" gutterBottom color="success.main">
            Final approved output
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Frozen snapshot stored after human approval.
          </Typography>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
            {JSON.stringify(
              {
                document_type:
                  document.extraction?.documentType ?? document.classification?.documentType,
                vendor: document.extraction?.vendor ?? document.vendor?.name,
                ...document.approvedFields,
                confidence_score: document.extraction?.confidenceScore,
              },
              null,
              2,
            )}
          </Typography>
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Validation Warnings
        </Typography>
        <ValidationWarningCard warnings={document.validation?.warnings ?? []} />
      </Paper>
    </Stack>
  );
}

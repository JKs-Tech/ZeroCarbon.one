import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  Grid2,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DocumentCard } from '../../components/DocumentCard';
import { UploadGroupCard, isUploadGroup } from '../../components/UploadGroupCard';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { FileUpload } from '../../components/FileUpload';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PaginationControls } from '../../components/PaginationControls';
import { PAGE_SIZE, QUERY_KEYS, DocumentProcessingStatus } from '../../constants';
import {
  documentsApi,
  type BulkUploadProgress,
  type DocumentStatusFilter,
} from '../../services/documents.api';
import { getApiErrorMessage } from '../../services/api.client';
import { isProcessingStatus } from '../../utils/document-status';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<DocumentStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<BulkUploadProgress | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const limit = PAGE_SIZE.documents;

  const query = useQuery({
    queryKey: QUERY_KEYS.documentsList(page, limit, filter),
    queryFn: () => documentsApi.list(page, limit, filter),
    placeholderData: (previous) => previous,
    refetchInterval: (q) => {
      const docs = q.state.data?.documents ?? [];
      const hasActive =
        (q.state.data?.counts.processing ?? 0) > 0 ||
        docs.some((doc) => {
          if (isProcessingStatus(doc.processingStatus)) {
            return true;
          }
          if (doc.isUploadContainer) {
            return (
              doc.processingStatus === DocumentProcessingStatus.SPLITTING ||
              (doc.childStatusSummary?.processing ?? 0) > 0
            );
          }
          return false;
        });
      return hasActive ? 2000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress({
        percent: 0,
        completedFiles: 0,
        totalFiles: files.length,
        failedFiles: 0,
        phase: 'uploading',
        message: `Preparing ${files.length.toLocaleString()} file(s)…`,
      });
      return documentsApi.uploadBulk(files, (next) => {
        setProgress(next);
        if (next.completedFiles > 0 && next.completedFiles % 40 === 0) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
        }
      });
    },
    onSuccess: (result) => {
      const ok = result.documents.length;
      const failed = result.failed.length;
      setSuccessMessage(
        failed === 0
          ? `Uploaded ${ok.toLocaleString()} document(s) — processing in the background`
          : `Uploaded ${ok.toLocaleString()} document(s); ${failed.toLocaleString()} failed`,
      );
      setErrorMessage(
        failed > 0
          ? result.failed
              .slice(0, 3)
              .map((item) => `${item.fileName}: ${item.error}`)
              .join(' · ')
          : null,
      );
      setProgress(null);
      setFilter('all');
      setPage(1);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(getApiErrorMessage(error));
      setProgress(null);
    },
  });

  if (query.isLoading && !query.data) {
    return <LoadingSpinner label="Loading workspace…" />;
  }

  if (query.isError) {
    return (
      <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const documents = query.data?.documents ?? [];
  const counts = query.data?.counts ?? {
    all: 0,
    processing: 0,
    review: 0,
    approved: 0,
    failed: 0,
  };
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={700} letterSpacing="-0.02em">
          Workspace
        </Typography>
        <Typography variant="body1" color="text.secondary" mt={0.5}>
          Upload utility bills at any scale — large batches are chunked safely into the queue.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          background:
            'linear-gradient(160deg, rgba(27,77,62,0.06) 0%, rgba(255,255,255,0.9) 55%)',
        }}
      >
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Upload documents
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Pipeline: Upload → Queue → OCR → Agentic AI → Validation → Human review.
          Thousands of files upload in small batches so the browser and API stay responsive.
        </Typography>

        <FileUpload
          multiple
          disabled={uploadMutation.isPending}
          uploading={uploadMutation.isPending}
          progress={progress}
          onFilesSelected={(files) => {
            if (!files.length) {
              return;
            }
            setSuccessMessage(null);
            setErrorMessage(null);
            uploadMutation.mutate(files);
          }}
        />

        {successMessage ? (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        ) : null}
      </Paper>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${counts.all.toLocaleString()} total`} size="small" />
          {counts.processing > 0 ? (
            <Chip
              label={`${counts.processing.toLocaleString()} processing`}
              size="small"
              color="info"
            />
          ) : null}
          {counts.review > 0 ? (
            <Chip
              label={`${counts.review.toLocaleString()} waiting for review`}
              size="small"
              color="warning"
            />
          ) : null}
          {counts.approved > 0 ? (
            <Chip
              label={`${counts.approved.toLocaleString()} approved`}
              size="small"
              color="success"
              variant="outlined"
            />
          ) : null}
          {counts.failed > 0 ? (
            <Chip
              label={`${counts.failed.toLocaleString()} failed`}
              size="small"
              color="error"
              variant="outlined"
            />
          ) : null}
          {counts.processing > 0 ? (
            <Chip label="Live updates every 2s" size="small" variant="outlined" />
          ) : null}
        </Stack>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, value: DocumentStatusFilter | null) => {
            if (value) {
              setFilter(value);
              setPage(1);
            }
          }}
          aria-label="Filter documents"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="processing">Processing</ToggleButton>
          <ToggleButton value="review">Review</ToggleButton>
          <ToggleButton value="approved">Approved</ToggleButton>
          <ToggleButton value="failed">Failed</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {documents.length === 0 ? (
        <EmptyState
          title={counts.all === 0 ? 'No documents yet' : 'Nothing in this filter'}
          description={
            counts.all === 0
              ? 'Drop a PDF or image above to start extraction.'
              : 'Try another filter to see more documents.'
          }
        />
      ) : (
        <>
          <Grid2 container spacing={2}>
            {documents.map((document) => (
              <Grid2 key={document.id} size={{ xs: 12, md: 6, lg: 4 }}>
                {isUploadGroup(document) ? (
                  <UploadGroupCard document={document} />
                ) : (
                  <DocumentCard document={document} />
                )}
              </Grid2>
            ))}
          </Grid2>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onChange={setPage}
            disabled={query.isFetching}
          />
        </>
      )}
    </Stack>
  );
}

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { ReviewForm, type ReviewFormHandle } from '../../components/ReviewForm';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidationWarningCard } from '../../components/ValidationWarningCard';
import { DocumentProcessingStatus, QUERY_KEYS } from '../../constants';
import { reviewApi } from '../../services/review.api';
import { getApiErrorMessage } from '../../services/api.client';

export function HumanReviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formRef = useRef<ReviewFormHandle>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const reviewQuery = useQuery({
    queryKey: QUERY_KEYS.review(id),
    queryFn: () => reviewApi.getReview(id),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (fields: Record<string, string | number | null>) =>
      reviewApi.updateFields(id, fields),
    onSuccess: (payload) => {
      queryClient.setQueryData(QUERY_KEYS.review(id), payload);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(id) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => reviewApi.approve(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(id) });
      navigate(`/documents/${id}`);
    },
  });

  if (reviewQuery.isLoading) {
    return <LoadingSpinner label="Loading review…" />;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <ErrorState
        message={getApiErrorMessage(reviewQuery.error)}
        onRetry={() => void reviewQuery.refetch()}
      />
    );
  }

  const review = reviewQuery.data;
  const editable =
    review.document.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW;

  const handleApprove = async () => {
    setApproveError(null);
    try {
      // Always persist current form values before approve so edits are not lost.
      if (editable && formRef.current) {
        await updateMutation.mutateAsync(formRef.current.getMappedValues());
      }
      await approveMutation.mutateAsync();
    } catch (error) {
      setApproveError(getApiErrorMessage(error));
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Human Review</Typography>
        <StatusBadge status={review.document.processingStatus} />
      </Stack>

      {!editable ? (
        <Alert severity="info">
          This document is not waiting for review. Fields are read-only.
        </Alert>
      ) : (
        <Alert severity="info">
          Edit fields as needed, then Approve. Approving saves your latest edits and stores the
          final approved output.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Validation Warnings
        </Typography>
        <ValidationWarningCard warnings={review.validation?.warnings ?? []} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Extracted Fields
        </Typography>
        <ReviewForm
          ref={formRef}
          fields={review.editableFields}
          disabled={!editable}
          isSaving={updateMutation.isPending || approveMutation.isPending}
          onSubmit={async (fields) => {
            await updateMutation.mutateAsync(fields);
          }}
        />
        {updateMutation.isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {getApiErrorMessage(updateMutation.error)}
          </Alert>
        ) : null}
        {updateMutation.isSuccess && !approveMutation.isPending ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Fields saved.
          </Alert>
        ) : null}
      </Paper>

      <Stack direction="row" spacing={2}>
        <Button
          type="button"
          variant="contained"
          color="success"
          disabled={!editable || approveMutation.isPending || updateMutation.isPending}
          onClick={() => void handleApprove()}
        >
          {approveMutation.isPending || updateMutation.isPending
            ? 'Saving & approving…'
            : 'Approve'}
        </Button>
        <Button type="button" variant="outlined" onClick={() => navigate('/dashboard')}>
          Cancel
        </Button>
      </Stack>

      {approveError ? <Alert severity="error">{approveError}</Alert> : null}
      {approveMutation.isError ? (
        <Alert severity="error">{getApiErrorMessage(approveMutation.error)}</Alert>
      ) : null}
    </Stack>
  );
}

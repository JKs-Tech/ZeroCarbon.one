import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { DocumentProcessingStatus, QUERY_KEYS } from '../constants';
import type { DocumentSummary } from '../types/api';
import { documentsApi } from '../services/documents.api';
import { statusLabel } from '../utils/document-status';

interface UploadGroupCardProps {
  document: DocumentSummary;
}

function aggregateStatus(document: DocumentSummary): string {
  if (document.processingStatus === DocumentProcessingStatus.SPLITTING) {
    return DocumentProcessingStatus.SPLITTING;
  }

  const summary = document.childStatusSummary;
  if (!summary) {
    return document.processingStatus;
  }

  if (summary.processing > 0) {
    return DocumentProcessingStatus.PROCESSING;
  }
  if (summary.review > 0) {
    return DocumentProcessingStatus.WAITING_FOR_REVIEW;
  }
  if (summary.failed > 0 && summary.approved === 0) {
    return DocumentProcessingStatus.FAILED;
  }
  if (summary.approved === (document.pageDocumentCount ?? 0) && (document.pageDocumentCount ?? 0) > 0) {
    return DocumentProcessingStatus.APPROVED;
  }

  return document.processingStatus;
}

export function UploadGroupCard({ document }: UploadGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const billCount = document.pageDocumentCount ?? document.totalPages ?? 0;
  const displayStatus = aggregateStatus(document);
  const processing =
    document.processingStatus === DocumentProcessingStatus.SPLITTING ||
    (document.childStatusSummary?.processing ?? 0) > 0;
  const canExpand = billCount > 0 || document.processingStatus === DocumentProcessingStatus.SPLIT_COMPLETE;

  const pagesQuery = useQuery({
    queryKey: QUERY_KEYS.documentPages(document.id),
    queryFn: () => documentsApi.listPages(document.id),
    enabled: expanded && canExpand,
    refetchInterval: expanded && processing ? 2000 : false,
  });

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      variant="outlined"
      sx={{
        borderColor: processing ? 'primary.light' : 'divider',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={canExpand ? <ExpandMoreIcon /> : undefined}>
        <Stack spacing={1} sx={{ width: '100%', pr: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                {document.originalFileName}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                <Chip size="small" label={`${billCount} Bill${billCount === 1 ? '' : 's'}`} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(document.uploadTimestamp || document.createdAt).toLocaleString()}
                </Typography>
              </Stack>
            </Box>
            <StatusBadge status={displayStatus} />
          </Stack>

          {document.childStatusSummary ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(document.childStatusSummary.review ?? 0) > 0 ? (
                <Chip size="small" color="warning" label={`${document.childStatusSummary.review} in review`} />
              ) : null}
              {(document.childStatusSummary.approved ?? 0) > 0 ? (
                <Chip size="small" color="success" label={`${document.childStatusSummary.approved} approved`} />
              ) : null}
              {(document.childStatusSummary.failed ?? 0) > 0 ? (
                <Chip size="small" color="error" label={`${document.childStatusSummary.failed} failed`} />
              ) : null}
              {(document.childStatusSummary.processing ?? 0) > 0 ? (
                <Chip size="small" label={`${document.childStatusSummary.processing} processing`} />
              ) : null}
            </Stack>
          ) : null}

          {processing ? (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {document.processingStatus === DocumentProcessingStatus.SPLITTING
                    ? 'Splitting PDF into pages…'
                    : `Processing bills · ${statusLabel(displayStatus)}`}
                </Typography>
              </Stack>
              <LinearProgress sx={{ height: 6, borderRadius: 1 }} />
            </Box>
          ) : null}
        </Stack>
      </AccordionSummary>

      {canExpand ? (
        <AccordionDetails>
          {pagesQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading bills…
            </Typography>
          ) : pagesQuery.isError ? (
            <Typography variant="body2" color="error.main">
              Failed to load bills.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {(pagesQuery.data ?? []).map((pageDoc) => {
                const canReview =
                  pageDoc.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW;
                const failed = pageDoc.processingStatus === DocumentProcessingStatus.FAILED;
                const label =
                  pageDoc.pageNumber != null
                    ? `Bill ${pageDoc.pageNumber}`
                    : pageDoc.originalFileName;

                return (
                  <Stack
                    key={pageDoc.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: failed ? 'error.light' : canReview ? 'warning.light' : 'divider',
                    }}
                  >
                    <Stack spacing={0.25}>
                      <Typography variant="body2" fontWeight={600}>
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[
                          pageDoc.classification?.documentType ?? pageDoc.extraction?.documentType,
                          pageDoc.vendor?.name ?? pageDoc.extraction?.vendor,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Processing…'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusBadge status={pageDoc.processingStatus} />
                      <Button
                        size="small"
                        component={RouterLink}
                        to={`/documents/${pageDoc.id}`}
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
                          to={`/documents/${pageDoc.id}/review`}
                        >
                          Review
                        </Button>
                      ) : null}
                      {failed ? (
                        <Button
                          size="small"
                          color="error"
                          component={RouterLink}
                          to={`/documents/${pageDoc.id}`}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </AccordionDetails>
      ) : null}
    </Accordion>
  );
}

function isUploadGroup(document: DocumentSummary): boolean {
  return Boolean(document.isUploadContainer || (document.pageDocumentCount ?? 0) > 0);
}

export { isUploadGroup };

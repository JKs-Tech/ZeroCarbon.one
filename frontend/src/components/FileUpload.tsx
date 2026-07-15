import { useCallback, useRef, useState, type DragEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { ACCEPTED_UPLOAD_TYPES } from '../constants';
import type { BulkUploadProgress } from '../services/documents.api';

interface FileUploadProps {
  multiple?: boolean;
  disabled?: boolean;
  /** Rich progress for single or bulk uploads. */
  progress?: BulkUploadProgress | null;
  uploading?: boolean;
  onFilesSelected: (files: File[]) => void;
}

const acceptAttr = Object.values(ACCEPTED_UPLOAD_TYPES).flat().join(',');
const MAX_HINT =
  'PDF, PNG, JPG, JPEG · any number of files (uploaded in safe batches)';
const CHIP_PREVIEW_LIMIT = 8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  multiple = true,
  disabled,
  progress,
  uploading = false,
  onFilesSelected,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const acceptFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) {
        return;
      }
      const allowed = new Set(
        Object.keys(ACCEPTED_UPLOAD_TYPES).concat(['image/jpg']),
      );
      const valid = files.filter(
        (file) =>
          allowed.has(file.type) ||
          /\.(pdf|png|jpe?g)$/i.test(file.name),
      );
      if (!valid.length) {
        setLocalError('Only PDF, PNG, JPG, or JPEG files are accepted.');
        return;
      }
      if (valid.length !== files.length) {
        setLocalError(
          `${files.length - valid.length} unsupported file(s) skipped.`,
        );
      } else {
        setLocalError(null);
      }
      const next = multiple ? valid : valid.slice(0, 1);
      setSelected(next);
      onFilesSelected(next);
    },
    [multiple, onFilesSelected],
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled || uploading) {
      return;
    }
    acceptFiles(event.dataTransfer.files);
  };

  const showProgress = uploading || Boolean(progress);

  return (
    <Stack spacing={2}>
      <Box
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) {
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!disabled && !uploading) {
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled && !uploading) {
              inputRef.current?.click();
            }
          }
        }}
        aria-label="Upload utility bill files"
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          borderRadius: 2,
          px: 3,
          py: 4,
          textAlign: 'center',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          opacity: disabled || uploading ? 0.7 : 1,
          transition: 'border-color 0.2s ease, background-color 0.2s ease',
          outline: 'none',
          '&:focus-visible': {
            borderColor: 'primary.main',
            boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}33`,
          },
        }}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          multiple={multiple}
          accept={acceptAttr}
          disabled={disabled || uploading}
          onChange={(event) => {
            acceptFiles(event.target.files ?? []);
            event.target.value = '';
          }}
        />
        <CloudUploadOutlinedIcon
          sx={{ fontSize: 40, color: 'primary.main', mb: 1 }}
        />
        <Typography variant="subtitle1" fontWeight={600}>
          {uploading ? 'Uploading…' : 'Drop utility bills here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {MAX_HINT}
        </Typography>
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 2, pointerEvents: 'none' }}
          disabled={disabled || uploading}
        >
          Browse files
        </Button>
      </Box>

      {selected.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Selected {selected.length.toLocaleString()} file
            {selected.length === 1 ? '' : 's'}
            {selected.length > UPLOAD_PREVIEW_HINT_THRESHOLD
              ? ' — will upload in background batches'
              : ''}
          </Typography>
          {selected.length <= CHIP_PREVIEW_LIMIT ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {selected.map((file) => (
                <Chip
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  label={`${file.name} (${formatBytes(file.size)})`}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {selected.slice(0, CHIP_PREVIEW_LIMIT).map((file) => (
                <Chip
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  label={file.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              <Chip
                label={`+${(selected.length - CHIP_PREVIEW_LIMIT).toLocaleString()} more`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Stack>
          )}
        </Stack>
      ) : null}

      {localError ? <Alert severity="warning">{localError}</Alert> : null}

      {showProgress && progress ? (
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" id="upload-progress-label">
              {progress.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progress.completedFiles.toLocaleString()}/
              {progress.totalFiles.toLocaleString()} · {progress.percent}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress.percent}
            aria-labelledby="upload-progress-label"
            sx={{ height: 8, borderRadius: 1 }}
          />
          {progress.failedFiles > 0 ? (
            <Typography variant="caption" color="error.main" display="block" mt={0.5}>
              {progress.failedFiles.toLocaleString()} file(s) failed
            </Typography>
          ) : null}
        </Box>
      ) : showProgress ? (
        <LinearProgress sx={{ height: 8, borderRadius: 1 }} />
      ) : null}
    </Stack>
  );
}

const UPLOAD_PREVIEW_HINT_THRESHOLD = 20;

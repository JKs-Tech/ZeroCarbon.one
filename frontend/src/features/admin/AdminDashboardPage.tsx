import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Divider,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { PaginationControls } from '../../components/PaginationControls';
import { PAGE_SIZE, QUERY_KEYS, Role, type RoleValue } from '../../constants';
import { adminApi } from '../../services/admin.api';
import { documentsApi } from '../../services/documents.api';
import { getApiErrorMessage } from '../../services/api.client';
import { useAuth } from '../auth/AuthContext';

export function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [usersPage, setUsersPage] = useState(1);
  const [docsPage, setDocsPage] = useState(1);
  const usersLimit = PAGE_SIZE.users;
  const docsLimit = PAGE_SIZE.adminDocuments;

  const usersQuery = useQuery({
    queryKey: QUERY_KEYS.usersList(usersPage, usersLimit),
    queryFn: () => adminApi.listUsers(usersPage, usersLimit),
    placeholderData: (previous) => previous,
  });

  const documentsQuery = useQuery({
    queryKey: QUERY_KEYS.documentsList(docsPage, docsLimit, 'all'),
    queryFn: () => documentsApi.list(docsPage, docsLimit, 'all'),
    placeholderData: (previous) => previous,
    refetchInterval: 3000,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: RoleValue }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });

  if ((usersQuery.isLoading && !usersQuery.data) || (documentsQuery.isLoading && !documentsQuery.data)) {
    return <LoadingSpinner label="Loading admin data…" />;
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        message={getApiErrorMessage(usersQuery.error)}
        onRetry={() => void usersQuery.refetch()}
      />
    );
  }

  if (documentsQuery.isError) {
    return (
      <ErrorState
        message={getApiErrorMessage(documentsQuery.error)}
        onRetry={() => void documentsQuery.refetch()}
      />
    );
  }

  const users = usersQuery.data?.users ?? [];
  const documents = documentsQuery.data?.documents ?? [];

  const handleRoleChange = (userId: string, event: SelectChangeEvent) => {
    const role = event.target.value as RoleValue;
    if (role !== Role.ADMIN && role !== Role.USER) {
      return;
    }
    updateRoleMutation.mutate({ userId, role });
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={700} letterSpacing="-0.02em">
          Admin
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Manage roles and monitor every document in the platform.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Manage Users
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          View all accounts and update roles (ADMIN / USER).
        </Typography>
        {updateRoleMutation.isError ? (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {getApiErrorMessage(updateRoleMutation.error)}
          </Typography>
        ) : null}
        {users.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          <>
            <Table size="small" aria-label="Users table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const isSelf = currentUser?.id === user.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={user.role}
                            disabled={isSelf || updateRoleMutation.isPending}
                            onChange={(event) => handleRoleChange(user.id, event)}
                            aria-label={`Role for ${user.email}`}
                          >
                            <MenuItem value={Role.USER}>USER</MenuItem>
                            <MenuItem value={Role.ADMIN}>ADMIN</MenuItem>
                          </Select>
                        </FormControl>
                        {isSelf ? (
                          <Typography variant="caption" color="text.secondary">
                            Cannot demote yourself
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationControls
              page={usersPage}
              totalPages={usersQuery.data?.totalPages ?? 0}
              total={usersQuery.data?.total ?? 0}
              limit={usersLimit}
              onChange={setUsersPage}
              disabled={usersQuery.isFetching}
            />
          </>
        )}
      </Paper>

      <Divider />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          All Documents
        </Typography>
        {documents.length === 0 ? (
          <EmptyState title="No documents" />
        ) : (
          <>
            <Table size="small" aria-label="Documents table">
              <TableHead>
                <TableRow>
                  <TableCell>File</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{document.originalFileName}</TableCell>
                    <TableCell>{document.userId}</TableCell>
                    <TableCell>
                      <StatusBadge status={document.processingStatus} />
                    </TableCell>
                    <TableCell>
                      <Typography
                        component={RouterLink}
                        to={`/documents/${document.id}`}
                        variant="body2"
                      >
                        Open
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              page={docsPage}
              totalPages={documentsQuery.data?.totalPages ?? 0}
              total={documentsQuery.data?.total ?? 0}
              limit={docsLimit}
              onChange={setDocsPage}
              disabled={documentsQuery.isFetching}
            />
          </>
        )}
      </Paper>
    </Stack>
  );
}

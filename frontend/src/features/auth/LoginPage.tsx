import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { getApiErrorMessage } from '../../services/api.client';

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name required').max(120),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={from || '/dashboard'} replace />;
  }

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={2}
      sx={{
        background:
          'radial-gradient(900px 420px at 15% 10%, rgba(27,77,62,0.18), transparent), radial-gradient(700px 360px at 90% 20%, rgba(61,86,96,0.12), transparent), #eef3f0',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700} letterSpacing="-0.03em" gutterBottom>
          ZeroCarbon.one
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Utility bill extraction for carbon accounting and energy reporting.
        </Typography>

        <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Auth tabs">
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        {tab === 0 ? (
          <Box
            component="form"
            mt={2}
            noValidate
            onSubmit={loginForm.handleSubmit(async (values) => {
              setError(null);
              try {
                await login(values.email, values.password);
                navigate('/dashboard');
              } catch (err) {
                setError(getApiErrorMessage(err));
              }
            })}
          >
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                {...loginForm.register('email')}
                error={Boolean(loginForm.formState.errors.email)}
                helperText={loginForm.formState.errors.email?.message}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
                error={Boolean(loginForm.formState.errors.password)}
                helperText={loginForm.formState.errors.password?.message}
              />
              <Button type="submit" variant="contained" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? 'Signing in…' : 'Login'}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box
            component="form"
            mt={2}
            noValidate
            onSubmit={registerForm.handleSubmit(async (values) => {
              setError(null);
              try {
                await register(values.name, values.email, values.password);
                navigate('/dashboard');
              } catch (err) {
                setError(getApiErrorMessage(err));
              }
            })}
          >
            <Stack spacing={2}>
              <TextField
                label="Name"
                autoComplete="name"
                {...registerForm.register('name')}
                error={Boolean(registerForm.formState.errors.name)}
                helperText={registerForm.formState.errors.name?.message}
              />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                {...registerForm.register('email')}
                error={Boolean(registerForm.formState.errors.email)}
                helperText={registerForm.formState.errors.email?.message}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                {...registerForm.register('password')}
                error={Boolean(registerForm.formState.errors.password)}
                helperText={registerForm.formState.errors.password?.message}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={registerForm.formState.isSubmitting}
              >
                {registerForm.formState.isSubmitting ? 'Creating account…' : 'Register'}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

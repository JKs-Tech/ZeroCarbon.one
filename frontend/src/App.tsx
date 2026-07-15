import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRouter } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1b4d3e', contrastText: '#f7faf8' },
    secondary: { main: '#3d5660' },
    warning: { main: '#b7791f' },
    error: { main: '#b42318' },
    success: { main: '#2f6f4e' },
    background: { default: '#f3f6f4', paper: '#ffffff' },
    divider: 'rgba(27, 45, 40, 0.12)',
  },
  typography: {
    fontFamily: '"Figtree", "Segoe UI", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f3f6f4',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

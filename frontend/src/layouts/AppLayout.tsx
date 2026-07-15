import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

const navLinkSx = {
  color: 'inherit',
  textDecoration: 'none',
  px: 1.5,
  py: 0.75,
  borderRadius: 1,
  fontWeight: 600,
  fontSize: 14,
  opacity: 0.78,
  '&.active': {
    opacity: 1,
    bgcolor: 'rgba(255,255,255,0.14)',
  },
  '&:hover': {
    opacity: 1,
    bgcolor: 'rgba(255,255,255,0.1)',
  },
};

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 500px at 10% -10%, rgba(27,77,62,0.12), transparent), radial-gradient(900px 400px at 100% 0%, rgba(69,90,100,0.08), transparent), #f3f6f4',
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 64 }}>
          <Typography
            variant="h6"
            component={NavLink}
            to="/dashboard"
            sx={{
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              mr: 1,
            }}
          >
            ZeroCarbon.one
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ flexGrow: 1 }}>
            <Box component={NavLink} to="/dashboard" sx={navLinkSx}>
              Workspace
            </Box>
            {isAdmin ? (
              <Box component={NavLink} to="/admin" sx={navLinkSx}>
                Admin
              </Box>
            ) : null}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {user?.role}
              </Typography>
            </Box>
            <Button
              type="button"
              onClick={logout}
              variant="outlined"
              size="small"
              sx={{
                borderColor: 'rgba(255,255,255,0.45)',
                color: 'inherit',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.8)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
              }}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}

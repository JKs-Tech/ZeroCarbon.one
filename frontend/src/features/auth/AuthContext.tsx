import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKEN_STORAGE_KEY, QUERY_KEYS, Role, type RoleValue } from '../../constants';
import { authApi } from '../../services/auth.api';
import type { PublicUser } from '../../types/api';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );

  const profileQuery = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => authApi.profile(),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (profileQuery.isError) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
    }
  }, [profileQuery.isError]);

  const persistSession = useCallback(
    (accessToken: string, user: PublicUser) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);
      queryClient.setQueryData(QUERY_KEYS.profile, user);
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      persistSession(result.accessToken, result.user);
    },
    [persistSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await authApi.register(name, email, password);
      persistSession(result.accessToken, result.user);
    },
    [persistSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: profileQuery.data ?? null,
      token,
      isLoading: Boolean(token) && profileQuery.isLoading,
      isAuthenticated: Boolean(token && profileQuery.data),
      isAdmin: (profileQuery.data?.role as RoleValue | undefined) === Role.ADMIN,
      login,
      register,
      logout,
    }),
    [profileQuery.data, profileQuery.isLoading, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

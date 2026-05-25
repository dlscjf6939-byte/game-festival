import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AuthState = {
  accessToken: string;
  employeeId?: number | string;
  firstLoginYn?: boolean | 'Y' | 'N' | 'y' | 'n' | 'true' | 'false' | '1' | '0';
  id: string;
  name: string;
  profile?: Record<string, unknown>;
};

type AuthContextValue = {
  auth: AuthState | null;
  clearAuth: () => Promise<void>;
  isRestoring: boolean;
  setAuth: (nextAuth: AuthState) => Promise<void>;
};

const AUTH_STORAGE_KEY = 'game_app_auth';
const API_BASE = 'http://121.254.240.93:8090';
const LOG_PREFIX = '[AuthProfile]';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type ProfileResponse = {
  code?: string;
  data?: Record<string, unknown>;
  message?: string;
  success?: boolean;
};

class ProfileFetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProfileFetchError';
    this.status = status;
  }
}

function logProfileEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

async function fetchProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await fetch(`${API_BASE}/api/employee/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = (await response.json()) as ProfileResponse;

  if (!response.ok || json.success === false) {
    throw new ProfileFetchError(
      json.message || '프로필 조회에 실패했습니다.',
      response.status,
    );
  }

  return json;
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreAuth() {
      try {
        const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

        if (!cancelled && storedAuth) {
          const restoredAuth = JSON.parse(storedAuth) as AuthState;

          try {
            logProfileEvent('Fetching profile after auth restore');
            const profileResponse = await fetchProfile(
              restoredAuth.accessToken,
            );
            logProfileEvent('Profile response', profileResponse);

            if (!cancelled && profileResponse.data) {
              const nextAuth = {
                ...restoredAuth,
                profile: {
                  ...(restoredAuth.profile ?? {}),
                  ...profileResponse.data,
                },
              };

              await AsyncStorage.setItem(
                AUTH_STORAGE_KEY,
                JSON.stringify(nextAuth),
              );
              setAuthState(nextAuth);
            }
          } catch (error) {
            logProfileEvent('Profile fetch after auth restore failed', error);

            if (
              error instanceof ProfileFetchError &&
              error.status === 401 &&
              !cancelled
            ) {
              logProfileEvent('Clearing expired auth after profile 401');
              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
              setAuthState(null);
              return;
            }

            if (!cancelled) {
              setAuthState(restoredAuth);
            }
          }
        }
      } catch {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    void restoreAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      auth,
      clearAuth: async () => {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState(null);
      },
      isRestoring,
      setAuth: async (nextAuth: AuthState) => {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
        setAuthState(nextAuth);

        try {
          logProfileEvent('Fetching profile after login');
          const profileResponse = await fetchProfile(nextAuth.accessToken);
          logProfileEvent('Profile response', profileResponse);

          if (profileResponse.data) {
            const nextAuthWithProfile = {
              ...nextAuth,
              profile: {
                ...(nextAuth.profile ?? {}),
                ...profileResponse.data,
              },
            };

            await AsyncStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify(nextAuthWithProfile),
            );
            setAuthState(nextAuthWithProfile);
          }
        } catch (error) {
          logProfileEvent('Profile fetch after login failed', error);
        }
      },
    }),
    [auth, isRestoring],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

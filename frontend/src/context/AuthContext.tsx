import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMeApi, loginApi, signupApi } from "@/lib/api";
import {
  AUTH_STORAGE_EVENT,
  clearStoredAuth,
  getStoredAuth,
  saveStoredAuth,
  type AuthUser,
  type StoredAuth,
} from "@/lib/auth-storage";

type LoginInput = {
  email: string;
  password: string;
};

type SignupInput = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toStoredAuth = (token: string, user: AuthUser): StoredAuth => ({
  token,
  user,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<StoredAuth | null>(() => getStoredAuth());
  const [isAuthReady, setIsAuthReady] = useState(false);

  const setAuthState = useCallback((nextAuth: StoredAuth | null) => {
    setAuth(nextAuth);
    if (nextAuth) {
      saveStoredAuth(nextAuth);
      return;
    }
    clearStoredAuth();
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const current = getStoredAuth();
      if (!current?.token) {
        setAuthState(null);
        setIsAuthReady(true);
        return;
      }

      try {
        const me = await getMeApi();
        setAuthState(toStoredAuth(current.token, me.user));
      } catch (_error) {
        setAuthState(null);
      } finally {
        setIsAuthReady(true);
      }
    };

    void bootstrap();
  }, [setAuthState]);

  useEffect(() => {
    const syncFromStorage = () => {
      setAuth(getStoredAuth());
    };

    window.addEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
    };
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await loginApi(input);
      setAuthState(toStoredAuth(response.token, response.user));
    },
    [setAuthState]
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const response = await signupApi(input);
      setAuthState(toStoredAuth(response.token, response.user));
    },
    [setAuthState]
  );

  const logout = useCallback(() => {
    setAuthState(null);
  }, [setAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user || null,
      token: auth?.token || "",
      isAuthenticated: Boolean(auth?.token),
      isAuthReady,
      login,
      signup,
      logout,
    }),
    [auth, isAuthReady, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

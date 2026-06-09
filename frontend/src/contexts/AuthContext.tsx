import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface UserState {
  id: string;
  email: string;
  subscription_tier: string;
  usage: {
    tier: string;
    channels: { used: number; limit: number | null };
    packages_this_month: { used: number; limit: number | null };
    features: Record<string, boolean>;
  } | null;
}

interface AuthContextValue {
  user: UserState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  refetch: async () => {},
  isAuthenticated: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

function clearToken() {
  localStorage.removeItem("auth_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMe();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
      setUser(null);
      clearToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    setToken(data.token);
    await fetchUser();
  };

  const signup = async (email: string, password: string) => {
    const data = await api.signup(email, password);
    setToken(data.token);
    await fetchUser();
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refetch: fetchUser,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

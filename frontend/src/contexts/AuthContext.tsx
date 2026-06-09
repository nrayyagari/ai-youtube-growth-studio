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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  refetch: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMe();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refetch: fetchUser,
        isAuthenticated: !!user,
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

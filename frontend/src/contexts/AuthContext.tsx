import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

interface AuthContextValue {
  email: string | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  email: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  sendOtp: async () => {},
  verifyOtp: async () => {},
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
  const [token, setTokenState] = useState<string | null>(getToken());
  const [email, setEmail] = useState<string | null>(localStorage.getItem("auth_email"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      setTokenState(savedToken);
      setEmail(localStorage.getItem("auth_email"));
    }
    setLoading(false);
  }, []);

  const sendOtp = async (email: string) => {
    await api.otpSend(email);
  };

  const verifyOtp = async (email: string, otp: string) => {
    const data = await api.otpVerify(email, otp);
    setToken(data.token);
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_email", email);
    setTokenState(data.token);
    setEmail(email);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("auth_email");
    setTokenState(null);
    setEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        email,
        token,
        loading,
        isAuthenticated: !!token,
        sendOtp,
        verifyOtp,
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

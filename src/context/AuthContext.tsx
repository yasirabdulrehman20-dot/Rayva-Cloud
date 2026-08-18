import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../shared/types.js';

export type AuthView = 'login' | 'signup' | 'forgot' | 'reset' | 'verify';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authView: AuthView;
  isVerificationModalOpen: boolean;
  resetTokenInput: string;
  verificationTokenInput: string;
  unverifiedEmail: string;
  devVerificationToken: string | null;
  emailServiceConfigured: boolean | null;
  isDemoMode: boolean;
  demoActivationTicket: string | null;
  setAuthView: (view: AuthView) => void;
  setIsVerificationModalOpen: (open: boolean) => void;
  openVerificationModal: (email?: string, token?: string) => void;
  closeVerificationModal: () => void;
  setResetTokenInput: (token: string) => void;
  setVerificationTokenInput: (token: string) => void;
  setUnverifiedEmail: (email: string) => void;
  setDevVerificationToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: string) => Promise<{ unverified?: boolean; message?: string; emailDeliveryConfigured?: boolean; demoMode?: boolean; demoActivationTicket?: string }>;
  verifyEmail: (token: string) => Promise<{ message: string; email?: string }>;
  demoActivate: (email?: string) => Promise<{ message: string; email?: string }>;
  resendVerification: (email: string) => Promise<{ message: string; devVerificationToken?: string; emailDeliveryConfigured?: boolean }>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, role: string) => Promise<void>;
  refreshEmailServiceStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'rayva_auth_token';
const USER_KEY = 'rayva_user_data';

async function parseJsonResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Non-JSON response received from server:', res.status, contentType, text.slice(0, 200));
    throw new Error('Authentication service returned an invalid response. Please check the server/API configuration.');
  }

  try {
    return await res.json();
  } catch (err) {
    console.error('Failed to parse JSON response:', err);
    throw new Error('Authentication service returned an invalid response. Please check the server/API configuration.');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const [resetTokenInput, setResetTokenInput] = useState<string>('');
  const [verificationTokenInput, setVerificationTokenInput] = useState<string>('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>('');
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);
  const [emailServiceConfigured, setEmailServiceConfigured] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoActivationTicket, setDemoActivationTicket] = useState<string | null>(null);

  const openVerificationModal = (email?: string, tokenInput?: string) => {
    if (email) setUnverifiedEmail(email);
    if (tokenInput) setVerificationTokenInput(tokenInput);
    setIsVerificationModalOpen(true);
  };

  const closeVerificationModal = () => {
    setIsVerificationModalOpen(false);
  };

  const refreshEmailServiceStatus = async () => {
    try {
      const res = await fetch('/api/auth/email-service-status');
      if (res.ok) {
        const data = await parseJsonResponse(res);
        setEmailServiceConfigured(Boolean(data?.data?.configured));
        if (data?.data?.demoMode !== undefined) {
          setIsDemoMode(Boolean(data.data.demoMode));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch email service status:', e);
    }
  };

  useEffect(() => {
    refreshEmailServiceStatus();
    // Check hash for initial view routing and deep link support
    try {
      const hash = window.location.hash;
      if (hash.startsWith('#verify')) {
        const hashParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
        const tokenParam = hashParams.get('token');
        const emailParam = hashParams.get('email');
        if (tokenParam) setVerificationTokenInput(tokenParam);
        if (emailParam) setUnverifiedEmail(emailParam);
        setIsVerificationModalOpen(true);
        setAuthView('login');
      } else if (hash.startsWith('#reset')) {
        setAuthView('reset');
        const hashParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
        const tokenParam = hashParams.get('token');
        if (tokenParam) setResetTokenInput(tokenParam);
      }
    } catch (e) {
      // Ignore hash parse errors
    }

    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);

          // Verify with backend
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (res.ok) {
            const data = await parseJsonResponse(res);
            if (data.user) {
              setUser(data.user);
              localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            }
          } else {
            // Token invalid or expired
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
          }
        } catch (e) {
          console.error('Failed to parse stored auth session:', e);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (data.unverified) {
        setUnverifiedEmail(email);
        if (data.demoActivationTicket) {
          setDemoActivationTicket(data.demoActivationTicket);
        }
        setIsVerificationModalOpen(true);
        setAuthView('login');
      }
      throw new Error(data.error || 'Failed to sign in.');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const signup = async (name: string, email: string, password: string, role: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create account.');
    }

    if (data.unverified) {
      setUnverifiedEmail(email);
      if (data.demoActivationTicket) {
        setDemoActivationTicket(data.demoActivationTicket);
      }
      if (data.devVerificationToken) {
        setDevVerificationToken(data.devVerificationToken);
        setVerificationTokenInput(data.devVerificationToken);
      }
      setIsVerificationModalOpen(true);
      setAuthView('login');
      return {
        unverified: true,
        message: data.message,
        emailDeliveryConfigured: data.emailDeliveryConfigured,
        demoMode: data.demoMode,
        demoActivationTicket: data.demoActivationTicket,
      };
    }

    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return { unverified: false };
  };

  const demoActivate = async (emailInput?: string) => {
    const targetEmail = emailInput || unverifiedEmail;
    const ticket = demoActivationTicket;

    const res = await fetch('/api/auth/demo-activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket,
        email: targetEmail,
      }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Demo activation failed.');
    }

    // Reset demo ticket once consumed
    setDemoActivationTicket(null);

    return {
      message: data.message || 'Demo account activated successfully.',
      email: data.email,
    };
  };

  const verifyEmail = async (tokenInput: string) => {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Email verification failed.');
    }

    return {
      message: data.message || 'Email verified successfully.',
      email: data.email,
    };
  };

  const resendVerification = async (emailInput: string) => {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend verification instructions.');
    }

    if (data.devVerificationToken) {
      setDevVerificationToken(data.devVerificationToken);
    }

    return {
      message: data.message || 'Verification instructions generated.',
      devVerificationToken: data.devVerificationToken,
    };
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Password reset request failed.');
    }

    return {
      message: data.message || 'If an account exists, reset instructions have been generated.',
    };
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password.');
    }
  };

  const logout = async () => {
    if (token) {
      try {
        const res = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          await parseJsonResponse(res);
        }
      } catch (e) {
        console.error('Logout request warning:', e);
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthView('login');
  };

  const updateProfile = async (name: string, role: string) => {
    if (!token) throw new Error('Not authenticated.');

    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, role }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile.');
    }

    setUser(data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const handleSetAuthView = (view: AuthView) => {
    if (view === 'verify') {
      setIsVerificationModalOpen(true);
      setAuthView('login');
    } else {
      setAuthView(view);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authView,
        isVerificationModalOpen,
        resetTokenInput,
        verificationTokenInput,
        unverifiedEmail,
        devVerificationToken,
        emailServiceConfigured,
        isDemoMode,
        demoActivationTicket,
        setAuthView: handleSetAuthView,
        setIsVerificationModalOpen,
        openVerificationModal,
        closeVerificationModal,
        setResetTokenInput,
        setVerificationTokenInput,
        setUnverifiedEmail,
        setDevVerificationToken,
        login,
        signup,
        verifyEmail,
        demoActivate,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        refreshEmailServiceStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types/finance';
import {
  loginWithEmail,
  loginWithGoogle,
  logoutUser,
  registerWithEmail,
  subscribeToAuthState
} from '../services/authService';
import { getUserProfile } from '../services/firestoreService';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleDemoUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('finance_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.id !== 'demo_user') {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const isDemo = false;

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setCurrentUser(profile);
            localStorage.setItem('finance_user_session', JSON.stringify(profile));
          } else {
            const fallbackProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || 'user@gmail.com',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              photoURL: firebaseUser.photoURL || undefined,
              currency: 'INR',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setCurrentUser(fallbackProfile);
            localStorage.setItem('finance_user_session', JSON.stringify(fallbackProfile));
          }
        } catch (e) {
          console.error('Error fetching user profile:', e);
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('finance_user_session');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const user = await loginWithEmail(email, pass);
      setCurrentUser(user);
      localStorage.setItem('finance_user_session', JSON.stringify(user));
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = async () => {
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      setCurrentUser(user);
      localStorage.setItem('finance_user_session', JSON.stringify(user));
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, name: string) => {
    setLoading(true);
    try {
      const user = await registerWithEmail(email, pass, name);
      setCurrentUser(user);
      localStorage.setItem('finance_user_session', JSON.stringify(user));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    localStorage.removeItem('finance_user_session');
  };

  const toggleDemoUser = () => {
    // Demo mode removed
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isDemo,
        login,
        loginWithGoogle: loginGoogle,
        register,
        logout,
        toggleDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

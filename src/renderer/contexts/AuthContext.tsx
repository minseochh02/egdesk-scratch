import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  user_metadata?: any;
  app_metadata?: any;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (scopes?: string) => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signOut: async () => {},
  switchAccount: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 AuthContext: Initializing...');
    
    // Get initial session but don't auto-sign in
    // This allows users to choose which account to use
    const initAuth = async () => {
      try {
        console.log('🔐 AuthContext: Fetching initial session...');
        const result = await window.electron.auth.getSession();
        console.log('🔐 AuthContext: Initial session result:', { 
          success: result.success, 
          hasSession: !!result.session,
          hasUser: !!result.user 
        });
        
        // Don't auto-sign in - just check if a session exists
        // User can choose to use it or sign in with a different account
        if (result.success && result.session) {
          console.log('🔐 AuthContext: Found existing session for:', result.user?.email, '- automatically restoring session');
          // Automatically restore session so user stays logged in on refresh
          setSession(result.session);
          setUser(result.user);
        }
      } catch (error) {
        console.error('🔐 AuthContext: Failed to get initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    console.log('🔐 AuthContext: Setting up auth state listener...');
    const unsubscribe = window.electron.auth.onAuthStateChanged((data) => {
      console.log('🔐 AuthContext: Auth state changed event received!', data);
      console.log('🔐 AuthContext: Event details:', { 
        success: data.success, 
        hasSession: !!data.session,
        hasUser: !!data.user 
      });
      
      if (data.success && data.session) {
        console.log('🔐 AuthContext: Updating auth state with new session');
        setSession(data.session);
        setUser(data.user);
        setLoading(false);
      } else {
        console.log('🔐 AuthContext: Clearing auth state');
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    console.log('🔐 AuthContext: Auth state listener set up successfully');

    return () => {
      console.log('🔐 AuthContext: Cleaning up auth state listener');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async (scopes?: string) => {
    try {
      const result = await window.electron.auth.signInWithGoogle(scopes);
      if (!result.success) {
        console.error('Google sign-in failed:', result.error);
        throw new Error(result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithGithub = async () => {
    try {
      const result = await window.electron.auth.signInWithGithub();
      if (!result.success) {
        console.error('GitHub sign-in failed:', result.error);
        throw new Error(result.error || 'GitHub sign-in failed');
      }
    } catch (error: any) {
      console.error('Error signing in with GitHub:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const result = await window.electron.auth.signOut();
      if (result.success) {
        setSession(null);
        setUser(null);
      } else {
        console.error('Sign out failed:', result.error);
        throw new Error(result.error || 'Sign out failed');
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const switchAccount = async (userId: string) => {
    try {
      console.log('🔐 AuthContext: Switching to account', userId);
      const result = await window.electron.auth.switchAccount(userId);
      console.log('🔐 AuthContext: switchAccount result:', result);
      
      if (result.success && result.session) {
        console.log('🔐 AuthContext: Setting user and session:', result.session.user);
        setSession(result.session);
        setUser(result.session.user);
      } else {
        console.error('Switch account failed:', result.error);
        throw new Error(result.error || 'Switch account failed');
      }
    } catch (error: any) {
      console.error('Error switching account:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    switchAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


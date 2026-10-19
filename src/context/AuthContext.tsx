import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isNeonConfigured } from '@/lib/neon';
import {
  neonGetJwt,
  neonGetSession,
  neonRequestPasswordReset,
  neonResetPassword,
  neonSignIn,
  neonSignOut,
  neonSignUp,
} from '@/lib/neonAuth';

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthContextValue = {
  user: AppUser | null;
  /** True while the initial session check is running. */
  loading: boolean;
  /** True when Supabase isn't configured — accounts are local to the device. */
  isDemo: boolean;
  /** True when the Neon backend (Managed Auth) is configured and takes over. */
  isNeon: boolean;
  /** Mints a short-lived JWT for the Neon API; null outside Neon mode. */
  getAccessToken: () => Promise<string | null>;
  signUp: (params: { name: string; email: string; password: string }) => Promise<{ message?: string }>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Completes a reset with the one-time token from the email link. */
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_SESSION_KEY = 'babelish:demo-user';

/** Turns provider error strings into something a human wants to read. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password. Give it another try.';
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'This email already has an account. Try signing in instead.';
  if (m.includes('password should be') || m.includes('weak_password'))
    return 'Password must be at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts — wait a minute and try again.';
  if (m.includes('is invalid') || m.includes('valid email'))
    return 'That email address doesn’t look right.';
  if (m.includes('signups not allowed')) return 'Sign-ups are disabled on this project.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (isNeonConfigured) {
        // Neon mode: restore the stored Managed Auth session, validating it
        // against the auth server (clears it when expired/revoked).
        const restored = await neonGetSession();
        if (!mounted) return;
        setUser(restored ? { id: restored.id, email: restored.email, displayName: restored.name } : null);
        setLoading(false);
        return;
      }
      if (!supabase) {
        // Demo mode: restore a local session if one exists.
        try {
          const stored = await AsyncStorage.getItem(DEMO_SESSION_KEY);
          if (stored && mounted) setUser(JSON.parse(stored));
        } catch {
          // ignore corrupt storage
        }
        if (mounted) setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setUser(nextSession?.user ? toAppUser(nextSession.user) : null);
      });

      return () => subscription.unsubscribe();
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function persistDemoUser(next: AppUser | null) {
      setUser(next);
      try {
        if (next) await AsyncStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
        else await AsyncStorage.removeItem(DEMO_SESSION_KEY);
      } catch {
        // non-fatal
      }
    }

    return {
      user,
      loading,
      isDemo: !isSupabaseConfigured && !isNeonConfigured,
      isNeon: isNeonConfigured,
      async getAccessToken() {
        return isNeonConfigured ? neonGetJwt() : null;
      },
      async signUp({ name, email, password }) {
        if (isNeonConfigured) {
          const created = await neonSignUp({ name, email, password });
          setUser({ id: created.id, email: created.email, displayName: created.name });
          return {};
        }
        if (!supabase) {
          await persistDemoUser({ id: `demo-${Date.now()}`, email, displayName: name });
          return { message: 'Created a demo account on this device.' };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        });
        if (error) throw new Error(friendlyAuthError(error.message));
        if (!data.session) {
          return { message: 'Check your inbox to confirm your email, then sign in.' };
        }
        return {};
      },
      async signIn(email, password) {
        if (isNeonConfigured) {
          const signed = await neonSignIn(email, password);
          setUser({ id: signed.id, email: signed.email, displayName: signed.name });
          return;
        }
        if (!supabase) {
          const stored = await AsyncStorage.getItem(DEMO_SESSION_KEY);
          const parsed = stored ? (JSON.parse(stored) as AppUser) : null;
          await persistDemoUser(
            parsed ?? {
              id: `demo-${Date.now()}`,
              email,
              displayName: email.split('@')[0],
            }
          );
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyAuthError(error.message));
      },
      async resetPassword(email) {
        if (isNeonConfigured) {
          await neonRequestPasswordReset(email);
          return;
        }
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw new Error(friendlyAuthError(error.message));
      },
      async resetPasswordWithToken(token, newPassword) {
        if (isNeonConfigured) {
          await neonResetPassword(token, newPassword);
          return;
        }
        if (!supabase) {
          throw new Error('Password reset needs a real backend — this build is in demo mode.');
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(friendlyAuthError(error.message));
      },
      async signOut() {
        if (isNeonConfigured) {
          await neonSignOut();
          setUser(null);
          return;
        }
        if (!supabase) {
          await persistDemoUser(null);
          return;
        }
        await supabase.auth.signOut();
        setUser(null);
      },
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function toAppUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AppUser {
  const email = user.email ?? '';
  const displayName =
    (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    email.split('@')[0];
  return { id: user.id, email, displayName };
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

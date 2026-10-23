import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { parseAuthCallbackUrl } from '@/lib/authLinks';

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isDemo: boolean;
  /** True when the learner opened a password-recovery link and still needs to pick a password. */
  isPasswordRecovery: boolean;
  /** Clears recovery mode (e.g. after setting a new password or cancelling). */
  clearPasswordRecovery: () => void;
  /** Error message returned in an auth callback URL (e.g. expired recovery link). */
  authLinkError: string | null;
  /** Returns the active Supabase access token, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  signUp: (params: { name: string; email: string; password: string }) => Promise<{ message?: string }>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetPasswordWithToken: (token: string | undefined, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const DEMO_SESSION_KEY = 'babelish:demo-user';

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password. Give it another try.';
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'This email already has an account. Try signing in instead.';
  if (m.includes('password should be') || m.includes('weak_password'))
    return 'Password must be at least 8 characters.';
  if (m.includes('same_password') || m.includes('different from the old password'))
    return 'Choose a password different from your current one.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts — wait a minute and try again.';
  if (m.includes('is invalid') || m.includes('valid email'))
    return 'That email address doesn’t look right.';
  if (m.includes('expired') || m.includes('otp_expired'))
    return 'This reset link has expired. Request a fresh one.';
  if (m.includes('signups not allowed')) return 'Sign-ups are disabled on this project.';
  return message;
}

function buildAuthRedirectUrl(path: string): string {
  try {
    return Linking.createURL(path.replace(/^\/+/, ''));
  } catch {
    return `babelish://${path.replace(/^\/+/, '')}`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const handledUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeLinking: (() => void) | undefined;

    async function consumeCallbackUrl(rawUrl: string | null | undefined) {
      if (!rawUrl || !supabase) return;
      if (handledUrlsRef.current.has(rawUrl)) return;

      const parsed = parseAuthCallbackUrl(rawUrl);
      if (!parsed.hasAuthPayload && !parsed.errorDescription && !parsed.isRecovery) return;
      handledUrlsRef.current.add(rawUrl);

      if (parsed.isRecovery && mounted) {
        setIsPasswordRecovery(true);
      }
      if (parsed.errorDescription) {
        if (mounted) setAuthLinkError(friendlyAuthError(parsed.errorDescription));
      }

      try {
        if (parsed.accessToken && parsed.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (error && mounted) setAuthLinkError(friendlyAuthError(error.message));
        } else if (parsed.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (error && mounted) setAuthLinkError(friendlyAuthError(error.message));
        } else if (parsed.tokenHash && parsed.otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: parsed.otpType,
          });
          if (error && mounted) setAuthLinkError(friendlyAuthError(error.message));
        }
      } catch (err) {
        if (mounted && err instanceof Error) {
          setAuthLinkError(friendlyAuthError(err.message));
        }
      }

      // Strip sensitive tokens from the browser URL bar once consumed.
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        (window.location.hash.includes('access_token') ||
          window.location.hash.includes('error') ||
          window.location.search.includes('code=') ||
          window.location.search.includes('token_hash='))
      ) {
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {
          // Ignore restricted history environments.
        }
      }
    }

    async function bootstrap() {
      if (!supabase) {
        try {
          const stored = await AsyncStorage.getItem(DEMO_SESSION_KEY);
          if (stored && mounted) setUser(JSON.parse(stored) as AppUser);
        } catch {
          // Ignore corrupt demo storage.
        }
        if (mounted) setLoading(false);
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;
        setUser(nextSession?.user ? toAppUser(nextSession.user) : null);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();

      const initialUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.href
          : await Linking.getInitialURL().catch(() => null);
      await consumeCallbackUrl(initialUrl);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);

      const linkSub = Linking.addEventListener('url', ({ url }) => {
        void consumeCallbackUrl(url);
      });
      unsubscribeLinking = () => linkSub.remove();
    }

    void bootstrap();
    return () => {
      mounted = false;
      unsubscribeAuth?.();
      unsubscribeLinking?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function persistDemoUser(next: AppUser | null) {
      setUser(next);
      try {
        if (next) await AsyncStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
        else await AsyncStorage.removeItem(DEMO_SESSION_KEY);
      } catch {
        // Local demo persistence is best effort.
      }
    }

    return {
      user,
      loading,
      isDemo: !isSupabaseConfigured,
      isPasswordRecovery,
      authLinkError,
      clearPasswordRecovery() {
        setIsPasswordRecovery(false);
        setAuthLinkError(null);
      },
      async getAccessToken() {
        if (!supabase) return null;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token ?? null;
      },
      async signUp({ name, email, password }) {
        if (!supabase) {
          await persistDemoUser({ id: `demo-${Date.now()}`, email, displayName: name });
          return { message: 'Created a demo account on this device.' };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: buildAuthRedirectUrl('login'),
          },
        });
        if (error) throw new Error(friendlyAuthError(error.message));
        if (!data.session) return { message: 'Check your inbox to confirm your email, then sign in.' };
        return {};
      },
      async signIn(email, password) {
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
        setIsPasswordRecovery(false);
        setAuthLinkError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyAuthError(error.message));
      },
      async resetPassword(email) {
        if (!supabase) throw new Error('Password reset requires Supabase configuration.');
        setAuthLinkError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildAuthRedirectUrl('reset-password'),
        });
        if (error) throw new Error(friendlyAuthError(error.message));
      },
      async resetPasswordWithToken(token, newPassword) {
        if (!supabase) throw new Error('Password reset requires Supabase configuration.');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session && token) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });
          if (otpError) throw new Error(friendlyAuthError(otpError.message));
        } else if (!session && !token) {
          throw new Error('This reset link is missing or expired. Request a new password reset link.');
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(friendlyAuthError(error.message));
        setIsPasswordRecovery(false);
        setAuthLinkError(null);
      },
      async signOut() {
        setIsPasswordRecovery(false);
        setAuthLinkError(null);
        if (!supabase) {
          await persistDemoUser(null);
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(friendlyAuthError(error.message));
        setUser(null);
      },
    };
  }, [user, loading, isPasswordRecovery, authLinkError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function toAppUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AppUser {
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

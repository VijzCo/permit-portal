"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type Auth, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { subscribeUserProfile } from "@/lib/repos/users";
import { friendlyError } from "@/lib/errors";
import type { AppUser } from "@/lib/schemas";

export type AuthStatus = "loading" | "signed-out" | "no-profile" | "inactive" | "ready" | "error";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: AppUser | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, profile: null, error: null });

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let auth: Auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      setState({ status: "error", user: null, profile: null, error: friendlyError(err) });
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      if (!user) {
        setState({ status: "signed-out", user: null, profile: null, error: null });
        return;
      }
      setState((s) => ({ ...s, status: "loading", user }));
      unsubscribeProfile = subscribeUserProfile(
        user.uid,
        (profile) => {
          if (!profile) setState({ status: "no-profile", user, profile: null, error: null });
          else if (!profile.active) setState({ status: "inactive", user, profile, error: null });
          else setState({ status: "ready", user, profile, error: null });
        },
        (err) => setState({ status: "error", user, profile: null, error: friendlyError(err) }),
      );
    });
    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, isAdmin: state.status === "ready" && state.profile?.role === "admin", signOut }),
    [state, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

/** Profile of the signed-in, active user. Only call below the app guard. */
export function useCurrentUser(): AppUser {
  const { profile, status } = useAuth();
  if (status !== "ready" || !profile) throw new Error("useCurrentUser used outside the protected layout.");
  return profile;
}

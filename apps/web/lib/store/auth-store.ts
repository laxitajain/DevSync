import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { AuthResponse, AuthUser } from "../types";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (session: AuthResponse) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: (session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null })
    }),
    {
      name: "devsync-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken
      }),
      // Mark hydration complete so guarded screens can wait for localStorage to
      // load before deciding whether to redirect to /login.
      onRehydrateStorage: () => (state) => {
        useAuthStore.setState({ hydrated: true });
        void state;
      }
    }
  )
);

/**
 * Hook that returns true once the zustand persist store has rehydrated from
 * localStorage.  Works reliably with Next.js SSR where the onRehydrateStorage
 * callback can fire before any React component subscribes to the store.
 */
export function useHydrated(): boolean {
  const storeHydrated = useAuthStore((s) => s.hydrated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // On client mount, either the store already fired onRehydrateStorage
    // (storeHydrated === true) or it will fire shortly. Either way, once we're
    // in a useEffect we know we're on the client, so mark hydrated.
    // The persist middleware's onRehydrateStorage runs synchronously after
    // localStorage is read, which happens before React mounts in the browser.
    // The real issue is SSR: on the server hydrated=false, then the client
    // needs a re-render to pick up the true value. This useEffect ensures that.
    setHydrated(true);
    useAuthStore.setState({ hydrated: true });
  }, []);

  return hydrated || storeHydrated;
}

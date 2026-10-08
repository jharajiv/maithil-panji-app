"use client";
import { useCallback, useEffect, useState } from "react";
import { safeNextPath } from "@/lib/next-path";

export interface Account { id: string; name: string; email: string; phone?: string }
export interface AuthState { loading: boolean; enabled: boolean; dev: boolean; google: boolean; email: boolean; pending: { name: string; email: string } | null; account: Account | null }

/** Who is signed in on this browser (cookie session), and is sign-in available on this site at all? */
export function useAccount() {
  const [st, setSt] = useState<AuthState>({ loading: true, enabled: false, dev: false, google: false, email: true, pending: null, account: null });
  const refresh = useCallback(async () => {
    try {
      const j = await (await fetch("/api/auth/me", { cache: "no-store" })).json();
      setSt({ loading: false, enabled: !!j.enabled, dev: !!j.dev, google: !!j.google, email: j.email !== false, pending: j.pending ?? null, account: j.account ?? null });
    } catch { setSt((s) => ({ ...s, loading: false })); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); await refresh(); }, [refresh]);
  return { ...st, refresh, logout };
}

/** only ever follow in-site paths after sign-in */
export const safeNext = safeNextPath;

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppRole } from "@prisma/client";
import type { PlanId } from "@/lib/plans";
import type { Permission } from "@/lib/permissions";
import { hasPermissionInList } from "@/lib/permissions";
import { isEmbeddableEmbedParam } from "@/lib/embed-config";
import { parseJsonResponse } from "@/lib/fetch-json";
import {
  bootstrapEmbedSession,
  clientFetch,
  getEmbedSessionToken,
  hasEmbedSession,
} from "@/lib/embed-api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  locationId: string | null;
  plan?: PlanId;
  avatarUrl?: string | null;
  permissions?: Permission[];
  setupComplete?: boolean;
  isPlatformAdmin?: boolean;
  mfaEnabled?: boolean;
  emailVerifiedAt?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** True in iframe demo when `_st` is present (API calls can proceed). */
  embedSession: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  can: () => false,
  logout: async () => {},
  refresh: async () => {},
  embedSession: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const embedParam = searchParams.get("embed");
  const isEmbed = isEmbeddableEmbedParam(embedParam);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const retryRef = useRef(0);
  const stParam = searchParams.get("_st");

  const refresh = useCallback(async () => {
    if (isEmbed) {
      bootstrapEmbedSession(embedParam);
    }

    try {
      const res = await clientFetch("/api/auth/login");
      const data = await parseJsonResponse<{ user: AuthUser | null }>(res);
      if (data.user) {
        setUser(data.user);
        retryRef.current = 0;
        return;
      }

      if (isEmbed && getEmbedSessionToken() && retryRef.current < 4) {
        retryRef.current += 1;
        await new Promise((r) => setTimeout(r, 150 * retryRef.current));
        return refresh();
      }

      setUser(null);
    } catch {
      if (isEmbed && getEmbedSessionToken() && retryRef.current < 4) {
        retryRef.current += 1;
        await new Promise((r) => setTimeout(r, 150 * retryRef.current));
        return refresh();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [isEmbed, embedParam]);

  useEffect(() => {
    retryRef.current = 0;
    setLoading(true);
    void refresh();
  }, [refresh, stParam]);

  const logout = async () => {
    await clientFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  const can = (permission: Permission) => {
    if (user?.permissions?.length) {
      return hasPermissionInList(user.permissions, permission);
    }
    if (user?.role === "OWNER" || user?.role === "MANAGER") return true;
    if (isEmbed && hasEmbedSession()) return true;
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        can,
        logout,
        refresh,
        embedSession: isEmbed && hasEmbedSession(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

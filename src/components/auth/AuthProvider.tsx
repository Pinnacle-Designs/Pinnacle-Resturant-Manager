"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppRole } from "@prisma/client";
import type { PlanId } from "@/lib/plans";
import { hasPermission, type Permission } from "@/lib/permissions";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  locationId: string | null;
  plan?: PlanId;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  can: () => false,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  const can = (permission: Permission) =>
    user ? hasPermission(user.role, permission) : false;

  return (
    <AuthContext.Provider value={{ user, loading, can, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

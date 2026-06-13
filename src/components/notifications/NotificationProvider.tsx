"use client";

import { useEffect } from "react";
import { showCriticalNotifications } from "@/lib/notifications";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/permissions";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (loading || !user || !hasPermission(user.role, "view_insights")) return;

    fetch("/api/insights/critical")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.insights?.length > 0) {
          showCriticalNotifications(data.insights);
        }
      })
      .catch(console.error);
  }, [loading, user]);

  return <>{children}</>;
}

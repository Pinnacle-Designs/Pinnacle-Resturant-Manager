"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, HandCoins, Check, X } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatShiftTime } from "@/lib/schedule";

interface SwapRequest {
  id: string;
  kind: "SWAP" | "BID" | "DROP";
  status: string;
  message: string | null;
  createdAt: string;
  shift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    workRole: string | null;
    isOpen: boolean;
    staffMember: { name: string } | null;
  };
  requesterStaff: { id: string; name: string };
  offerShift?: { date: string; startTime: string; endTime: string } | null;
}

export function ShiftSwapClient() {
  const { can } = useAuth();
  const canApprove = can("approve_shift_swaps") || can("manage_schedule");
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [openShifts, setOpenShifts] = useState<SwapRequest["shift"][]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [swapRes, schedRes] = await Promise.all([
        fetch("/api/shift-swaps?status=PENDING"),
        fetch(`/api/schedule/my?weekStart=${new Date().toISOString()}`),
      ]);
      const swapData = await swapRes.json();
      const schedData = await schedRes.json();
      setRequests(swapData.requests || []);
      setOpenShifts(schedData.openShifts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bidOnShift = async (shiftId: string) => {
    setActing(shiftId);
    try {
      const res = await fetch("/api/shift-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "BID", shiftId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActing(null);
    }
  };

  const review = async (id: string, action: "approve" | "deny") => {
    setActing(id);
    try {
      const res = await fetch(`/api/shift-swaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const kindLabel = (k: string) =>
    k === "BID" ? "Claim open shift" : k === "DROP" ? "Drop shift" : "Swap shift";

  if (loading) {
    return <p className="text-center text-slate-500 py-8">Loading shift requests…</p>;
  }

  return (
    <div className="space-y-6">
      {openShifts.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <HandCoins className="h-4 w-4 text-orange-500" />
            Open shifts — claim a slot
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {openShifts.map((s) => (
              <div key={s.id} className="rounded-xl border bg-white p-4">
                <p className="font-medium text-slate-900">
                  {format(new Date(s.date), "EEE MMM d")}
                </p>
                <p className="text-sm text-slate-600">
                  {formatShiftTime(s.startTime, s.endTime)}
                  {s.workRole && ` · ${s.workRole}`}
                </p>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!!acting}
                  onClick={() => bidOnShift(s.id)}
                >
                  {acting === s.id ? "Submitting…" : "Request shift"}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ArrowLeftRight className="h-4 w-4" />
          Pending requests
        </h3>
        {requests.length === 0 ? (
          <EmptyState
            title="No pending shift requests"
            description="Swap or bid requests from your team will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        r.kind === "BID"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {kindLabel(r.kind)}
                    </span>
                    <p className="mt-1 font-medium text-slate-900">{r.requesterStaff.name}</p>
                    <p className="text-sm text-slate-600">
                      {format(new Date(r.shift.date), "EEE MMM d")} ·{" "}
                      {formatShiftTime(r.shift.startTime, r.shift.endTime)}
                    </p>
                    {r.message && <p className="mt-1 text-xs text-slate-500">{r.message}</p>}
                  </div>
                  {canApprove && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!acting}
                        onClick={() => review(r.id, "deny")}
                      >
                        <X className="h-4 w-4" />
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        disabled={!!acting}
                        onClick={() => review(r.id, "approve")}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

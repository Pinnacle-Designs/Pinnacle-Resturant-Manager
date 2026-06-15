"use client";

import { useCallback, useEffect, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import { MapPin, Clock, LogIn, LogOut, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface TimeClockState {
  staff: { id: string; name: string; role: string };
  location: {
    name: string;
    mealBreakMinutes: number;
    restBreakMinutes: number;
    geoClockInRequired: boolean;
  };
  clockedIn: boolean;
  activeEntry: {
    id: string;
    clockInAt: string;
    geoVerifiedIn: boolean;
  } | null;
  todayShifts: Array<{
    id: string;
    startTime: string;
    endTime: string;
    workRole: string | null;
  }>;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export function TimeClockClient() {
  const [state, setState] = useState<TimeClockState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAttestation, setShowAttestation] = useState(false);
  const [mealBreakTaken, setMealBreakTaken] = useState(true);
  const [restBreakTaken, setRestBreakTaken] = useState(true);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/timeclock");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load time clock");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [load]);

  const clockIn = async () => {
    setBusy(true);
    setError(null);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await getPosition();
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        if (state?.location.geoClockInRequired) {
          throw new Error("Enable location access to clock in at the restaurant.");
        }
      }

      const res = await fetch("/api/timeclock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clock in failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clock in failed");
    } finally {
      setBusy(false);
    }
  };

  const clockOut = async () => {
    setBusy(true);
    setError(null);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await getPosition();
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // optional on clock out
      }

      const res = await fetch("/api/timeclock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          mealBreakTaken,
          restBreakTaken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clock out failed");
      setShowAttestation(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clock out failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-center text-slate-500 py-12">Loading time clock…</p>;
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-white p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-3 text-slate-700">{error || "Time clock unavailable"}</p>
      </div>
    );
  }

  const elapsedMins = state.activeEntry
    ? differenceInMinutes(now, new Date(state.activeEntry.clockInAt))
    : 0;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">{state.location.name}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{state.staff.name}</p>
        <p className="text-sm text-slate-500">{state.staff.role}</p>

        <div className="my-6">
          <p className="text-4xl font-bold tabular-nums text-slate-900">
            {format(now, "h:mm a")}
          </p>
          <p className="text-sm text-slate-500">{format(now, "EEEE, MMM d")}</p>
        </div>

        {state.clockedIn && state.activeEntry && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            Clocked in since {format(new Date(state.activeEntry.clockInAt), "h:mm a")}
            {elapsedMins > 0 && ` · ${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`}
            {state.activeEntry.geoVerifiedIn && (
              <span className="mt-1 flex items-center justify-center gap-1 text-xs">
                <MapPin className="h-3 w-3" /> Location verified
              </span>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {!state.clockedIn ? (
          <Button className="w-full" size="lg" onClick={clockIn} disabled={busy}>
            <LogIn className="h-5 w-5" />
            {busy ? "Verifying location…" : "Clock in"}
          </Button>
        ) : showAttestation ? (
          <div className="space-y-4 text-left">
            <p className="text-sm font-medium text-slate-900">Break attestation (required)</p>
            <p className="text-xs text-slate-500">
              Confirm you received your legally mandated breaks before clocking out.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={mealBreakTaken}
                onChange={(e) => setMealBreakTaken(e.target.checked)}
                className="mt-1"
              />
              <span>
                I received my meal break ({state.location.mealBreakMinutes}+ min unpaid)
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={restBreakTaken}
                onChange={(e) => setRestBreakTaken(e.target.checked)}
                className="mt-1"
              />
              <span>
                I received my rest break ({state.location.restBreakMinutes}+ min paid)
              </span>
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAttestation(false)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={clockOut}
                disabled={busy || !mealBreakTaken || !restBreakTaken}
              >
                {busy ? "Clocking out…" : "Confirm & clock out"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={() => setShowAttestation(true)}
            disabled={busy}
          >
            <LogOut className="h-5 w-5" />
            Clock out
          </Button>
        )}

        {state.location.geoClockInRequired && !state.clockedIn && (
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3" />
            Geo-fenced — must be at restaurant to clock in
          </p>
        )}
      </div>

      {state.todayShifts.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock className="h-4 w-4" />
            Today&apos;s schedule
          </p>
          <ul className="space-y-2 text-sm">
            {state.todayShifts.map((s) => (
              <li key={s.id} className="flex justify-between text-slate-600">
                <span>{s.workRole || state.staff.role}</span>
                <span>
                  {s.startTime} – {s.endTime}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Clock,
  LogIn,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  Camera,
  MapPin,
} from "lucide-react";
import { usePageSearch } from "@/hooks/usePageSearch";
import { Button, Badge } from "@/components/ui";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { Modal } from "@/components/ui/form";
import { PinPad } from "@/components/staff/PinPad";
import { PunchPhotoCapture } from "@/components/staff/PunchPhotoCapture";
import { verifyBiometric } from "@/lib/timeclock/webauthn-client";
import { punchVerificationLabel } from "@/lib/timeclock/types";
import { formatCurrency } from "@/lib/utils";
import { BREAK_WAIVER_TEXT, isMealBreakRequired } from "@/lib/compliance/break-enforcement";
import { isTippedPunch } from "@/lib/compliance/tip-declaration";

type PunchAction = "in" | "out";

interface JobRoleOption {
  role: string;
  hourlyRate: number;
  isTippedRole: boolean;
  tipPoints: number;
}

interface KioskStaff {
  id: string;
  name: string;
  role: string;
  isTippedEmployee: boolean;
  imageUrl: string | null;
  hasPin: boolean;
  clockedIn: boolean;
  clockInAt: string | null;
  clockedInRole: string | null;
  clockedInRate: number | null;
  jobRoles: JobRoleOption[];
  todayShifts: Array<{ startTime: string; endTime: string; workRole?: string | null }>;
}

interface KioskLocation {
  name: string;
  geoClockInRequired: boolean;
  punchPhotoRequired: boolean;
  punchVerificationMode: string;
  earlyClockInBufferMins: number;
  mealBreakMinutes: number;
  restBreakMinutes: number;
  mealBreakRequiredAfterHours: number;
}

interface KioskCompliance {
  requireTipDeclaration: boolean;
}

type Step = "idle" | "pick" | "role" | "pin" | "verify" | "attest" | "waiver" | "tips" | "success";

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
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useState<KioskLocation | null>(null);
  const [compliance, setCompliance] = useState<KioskCompliance>({ requireTipDeclaration: true });
  const [staff, setStaff] = useState<KioskStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [action, setAction] = useState<PunchAction>("in");
  const [selected, setSelected] = useState<KioskStaff | null>(null);
  const [selectedWorkRole, setSelectedWorkRole] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const { query: search, setQuery: setSearch } = usePageSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealBreakTaken, setMealBreakTaken] = useState(true);
  const [restBreakTaken, setRestBreakTaken] = useState(true);
  const [breakWaiverAcknowledged, setBreakWaiverAcknowledged] = useState(false);
  const [declaredCashTips, setDeclaredCashTips] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/timeclock/kiosk");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load time clock");
      setLocation(data.location);
      setCompliance(data.compliance ?? { requireTipDeclaration: true });
      setStaff(data.staff ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [load]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = staff;
    if (action === "in") list = list.filter((s) => !s.clockedIn);
    else list = list.filter((s) => s.clockedIn);

    if (!q) return list;
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)
    );
  }, [staff, search, action]);

  const needsIdentityVerification = () => {
    if (!location?.punchPhotoRequired) return false;
    const mode = location.punchVerificationMode;
    return mode === "PHOTO" || mode === "BIOMETRIC" || mode === "PHOTO_OR_BIOMETRIC";
  };

  const canUsePhoto = () => {
    const mode = location?.punchVerificationMode;
    return mode === "PHOTO" || mode === "PHOTO_OR_BIOMETRIC";
  };

  const canUseBiometric = () => {
    const mode = location?.punchVerificationMode;
    return mode === "BIOMETRIC" || mode === "PHOTO_OR_BIOMETRIC";
  };

  const resetFlow = () => {
    setStep("idle");
    setSelected(null);
    setSelectedWorkRole(null);
    setPin("");
    setSearch("");
    setError(null);
    setMealBreakTaken(true);
    setRestBreakTaken(true);
    setBreakWaiverAcknowledged(false);
    setDeclaredCashTips("");
  };

  const closeModal = () => {
    resetFlow();
  };

  const startAction = (next: PunchAction) => {
    setAction(next);
    setError(null);
    setSearch("");
    setStep("pick");
  };

  const selectStaff = (member: KioskStaff) => {
    if (!member.hasPin) {
      setError("No clock PIN on file — ask your manager to set one.");
      return;
    }
    setSelected(member);
    setPin("");
    setError(null);

    if (action === "out") {
      setStep("pin");
      return;
    }

    const scheduledRole = member.todayShifts.find((s) => s.workRole)?.workRole ?? null;
    const defaultRole =
      scheduledRole && member.jobRoles.some((r) => r.role === scheduledRole)
        ? scheduledRole
        : member.jobRoles[0]?.role ?? member.role;

    setSelectedWorkRole(defaultRole);

    if (member.jobRoles.length > 1) {
      setStep("role");
    } else {
      setStep("pin");
    }
  };

  const selectWorkRole = (role: string) => {
    setSelectedWorkRole(role);
    setStep("pin");
  };

  const afterPin = () => {
    if (action === "out") {
      setStep("attest");
      return;
    }
    if (needsIdentityVerification() && process.env.NODE_ENV !== "development") {
      setStep("verify");
      return;
    }
    void submitPunch({});
  };

  const needsBreakWaiverStep = () => {
    if (!selected?.clockInAt || !location) return false;
    return (
      !mealBreakTaken &&
      isMealBreakRequired(new Date(selected.clockInAt), location)
    );
  };

  const needsTipDeclarationStep = () => {
    if (!selected || !compliance.requireTipDeclaration) return false;
    return isTippedPunch({
      workRole: selected.clockedInRole,
      isTippedEmployee: selected.isTippedEmployee,
      jobRoles: selected.jobRoles,
    });
  };

  const proceedAfterComplianceSteps = () => {
    if (needsIdentityVerification() && process.env.NODE_ENV !== "development") {
      setStep("verify");
      return;
    }
    void submitPunch({});
  };

  const afterAttest = () => {
    if (needsBreakWaiverStep()) {
      setStep("waiver");
      return;
    }
    if (needsTipDeclarationStep()) {
      setStep("tips");
      return;
    }
    proceedAfterComplianceSteps();
  };

  const afterWaiver = () => {
    if (needsTipDeclarationStep()) {
      setStep("tips");
      return;
    }
    proceedAfterComplianceSteps();
  };

  const afterTips = () => {
    proceedAfterComplianceSteps();
  };

  const submitPunch = async (opts: {
    photoDataUrl?: string;
    biometricVerified?: boolean;
    attest?: boolean;
  }) => {
    if (!selected) return;
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
        if (location?.geoClockInRequired && process.env.NODE_ENV !== "development") {
          throw new Error("Enable location access to punch at the restaurant.");
        }
      }

      const res = await fetch("/api/timeclock/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          staffMemberId: selected.id,
          pin,
          workRole: action === "in" ? selectedWorkRole : undefined,
          latitude,
          longitude,
          photoDataUrl: opts.photoDataUrl,
          biometricVerified: opts.biometricVerified,
          mealBreakTaken: action === "out" ? mealBreakTaken : undefined,
          restBreakTaken: action === "out" ? restBreakTaken : undefined,
          breakWaiverAcknowledged:
            action === "out" && needsBreakWaiverStep() ? breakWaiverAcknowledged : undefined,
          declaredCashTips:
            action === "out" && needsTipDeclarationStep()
              ? parseFloat(declaredCashTips) || 0
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Punch failed");

      setSuccessMsg(
        action === "in"
          ? `${data.staffName} clocked in as ${data.workRole ?? selectedWorkRole} at ${format(new Date(), "h:mm a")}`
          : `${data.staffName} clocked out at ${format(new Date(), "h:mm a")}`
      );
      setStep("success");
      await load();
      setTimeout(() => closeModal(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Punch failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyWithBiometric = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyBiometric();
      await submitPunch({ biometricVerified: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric verification failed");
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-16 text-center text-slate-500">Loading time clock…</p>;
  }

  if (loadError || !location) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-3 text-slate-700">{loadError || "Time clock unavailable"}</p>
        <Button className="mt-4" variant="secondary" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const modalOpen = step !== "idle";

  const clockedInStaff = staff.filter((s) => s.clockedIn);

  return (
    <>
      <PageSectionShell pageId="timeclock-kiosk">
        <PageSection
          id="tc-punch"
          title="Clock in / out"
          description={location.name}
          defaultOpen
        >
          <div className="mx-auto max-w-lg">
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
              <div className="my-8">
                <p className="text-6xl font-bold tabular-nums tracking-tight text-slate-900">
                  {format(now, "h:mm:ss a")}
                </p>
                <p className="mt-2 text-lg text-slate-500">{format(now, "EEEE, MMMM d, yyyy")}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  size="lg"
                  className="h-20 flex-col gap-2 text-base"
                  onClick={() => startAction("in")}
                >
                  <LogIn className="h-7 w-7" />
                  Clock in
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-20 flex-col gap-2 text-base"
                  onClick={() => startAction("out")}
                >
                  <LogOut className="h-7 w-7" />
                  Clock out
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
                {location.geoClockInRequired && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> GPS geofence
                  </span>
                )}
                {location.punchPhotoRequired && (
                  <span className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    {punchVerificationLabel(location.punchVerificationMode)}
                  </span>
                )}
                {location.earlyClockInBufferMins > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {location.earlyClockInBufferMins}m early buffer
                  </span>
                )}
              </div>
            </div>
          </div>
        </PageSection>

        {clockedInStaff.length > 0 && (
          <PageSection
            id="tc-on-clock"
            title="On the clock now"
            description={`${clockedInStaff.length} team member${clockedInStaff.length === 1 ? "" : "s"} punched in`}
          >
            <div className="mx-auto max-w-lg rounded-xl bg-slate-50 p-4">
              <ul className="space-y-1 text-sm text-slate-600">
                {clockedInStaff.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span>
                      {s.name}
                      {s.clockedInRole && (
                        <span className="text-slate-400"> · {s.clockedInRole}</span>
                      )}
                    </span>
                    <span className="text-slate-400 shrink-0">
                      {s.clockInAt ? format(new Date(s.clockInAt), "h:mm a") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </PageSection>
        )}
      </PageSectionShell>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          step === "pick"
            ? action === "in"
              ? "Who is clocking in?"
              : "Who is clocking out?"
            : step === "role"
              ? `Which role today? — ${selected?.name}`
              : step === "pin"
              ? `Enter PIN — ${selected?.name}`
              : step === "verify"
                ? "Identity verification"
                : step === "attest"
                  ? "Break attestation"
                  : step === "waiver"
                    ? "Meal break waiver"
                    : step === "tips"
                      ? "Declare cash tips"
                      : "Done"
        }
        size={step === "verify" && canUsePhoto() ? "lg" : "md"}
      >
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "pick" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search by name or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                autoFocus
              />
            </div>

            {filteredStaff.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {action === "in"
                  ? "No one available to clock in."
                  : "No one is currently clocked in."}
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {filteredStaff.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => selectStaff(member)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-sm text-slate-500">{member.role}</p>
                        {member.todayShifts.length > 0 && (
                          <p className="text-xs text-slate-400">
                            Shift {member.todayShifts.map((s) => `${s.startTime}–${s.endTime}`).join(", ")}
                          </p>
                        )}
                      </div>
                      {!member.hasPin ? (
                        <Badge className="bg-amber-100 text-amber-800">No PIN</Badge>
                      ) : member.clockedIn ? (
                        <Badge className="bg-green-100 text-green-800">On clock</Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "role" && selected && (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-600">
              Which role are you working today? Pay rate applies to this punch only.
            </p>
            <ul className="space-y-2">
              {selected.jobRoles.map((job) => (
                <li key={job.role}>
                  <button
                    type="button"
                    onClick={() => selectWorkRole(job.role)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 ${
                      selectedWorkRole === job.role
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{job.role}</span>
                    <span className="text-sm text-slate-600">
                      {formatCurrency(job.hourlyRate)}/hr
                      {job.isTippedRole ? " · tipped" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="w-full" onClick={() => setStep("pick")}>
              Back
            </Button>
          </div>
        )}

        {step === "pin" && selected && (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-500">
              {action === "in" && selectedWorkRole
                ? `Clocking in as ${selectedWorkRole} · enter your PIN`
                : "Enter your 4–6 digit clock PIN"}
            </p>
            <PinPad value={pin} onChange={setPin} maxLength={6} disabled={busy} />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  setStep(action === "in" && selected.jobRoles.length > 1 ? "role" : "pick")
                }
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={pin.length < 4 || busy}
                onClick={afterPin}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "attest" && location && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirm breaks received before clocking out, {selected?.name}.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={mealBreakTaken}
                onChange={(e) => setMealBreakTaken(e.target.checked)}
                className="mt-1"
              />
              <span>
                Meal break ({location.mealBreakMinutes}+ min unpaid)
                {!mealBreakTaken && selected?.clockInAt && isMealBreakRequired(new Date(selected.clockInAt), location) && (
                  <span className="block text-amber-700">Required — skipping requires a signed waiver next.</span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={restBreakTaken}
                onChange={(e) => setRestBreakTaken(e.target.checked)}
                className="mt-1"
              />
              <span>Rest break ({location.restBreakMinutes}+ min paid)</span>
            </label>
            <Button className="w-full" disabled={busy} onClick={afterAttest}>
              Continue
            </Button>
          </div>
        )}

        {step === "waiver" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You have worked {location?.mealBreakRequiredAfterHours}+ hours without a meal break.
              You must sign below to voluntarily waive your break before clocking out.
            </div>
            <p className="text-sm text-slate-600">{BREAK_WAIVER_TEXT}</p>
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={breakWaiverAcknowledged}
                onChange={(e) => setBreakWaiverAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span>I acknowledge and sign this waiver</span>
            </label>
            <Button
              className="w-full"
              disabled={busy || !breakWaiverAcknowledged}
              onClick={afterWaiver}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "tips" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tipped employees must declare cash tips before clocking out.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Cash tips tonight ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={declaredCashTips}
                onChange={(e) => setDeclaredCashTips(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg tabular-nums focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                placeholder="0.00"
                autoFocus
              />
            </label>
            <Button
              className="w-full"
              disabled={busy || declaredCashTips === "" || Number(declaredCashTips) < 0}
              onClick={afterTips}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "verify" && selected && (
          <div className="space-y-4">
            {canUseBiometric() && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={verifyWithBiometric}
                disabled={busy}
              >
                <Fingerprint className="h-4 w-4" />
                Use Touch ID / Face ID
              </Button>
            )}
            {canUsePhoto() && (
              <PunchPhotoCapture
                staffName={selected.name}
                busy={busy}
                onCancel={() => setStep(action === "out" ? "attest" : "pin")}
                onCapture={(dataUrl) => submitPunch({ photoDataUrl: dataUrl })}
              />
            )}
            {!canUsePhoto() && !canUseBiometric() && (
              <Button className="w-full" onClick={() => submitPunch({})} disabled={busy}>
                Continue
              </Button>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <p className="mt-4 text-lg font-semibold text-slate-900">{successMsg}</p>
          </div>
        )}
      </Modal>
    </>
  );
}

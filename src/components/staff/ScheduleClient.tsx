"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  Calendar,
} from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { Input, Select, Textarea, FormField, Modal } from "@/components/ui/form";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import {
  getWeekStart,
  getWeekDays,
  formatWeekRange,
  toDateKey,
  shiftDurationHours,
  formatShiftTime,
  addWeeksToDate,
  roleColor,
  SHIFT_PRESETS,
} from "@/lib/schedule";
import { JOB_ROLES } from "@/lib/payroll/job-roles";
import { cn } from "@/lib/utils";
import { LaborForecastPanel } from "@/components/staff/LaborForecastPanel";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

interface Shift {
  id: string;
  staffMemberId: string;
  date: string;
  startTime: string;
  endTime: string;
  workRole: string | null;
  notes: string | null;
  staffMember: StaffMember;
}

interface ScheduleClientProps {
  staff: StaffMember[];
}

const emptyForm = {
  staffMemberId: "",
  date: "",
  startTime: "09:00",
  endTime: "17:00",
  workRole: "",
  notes: "",
};

export function ScheduleClient({ staff }: ScheduleClientProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const activeStaff = staff.filter((s) => s.active);
  const weekDays = getWeekDays(weekStart);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schedule?weekStart=${weekStart.toISOString()}`
      );
      const data = await res.json();
      setShifts(data.shifts || []);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const getShiftsForCell = (staffId: string, day: Date) => {
    const key = toDateKey(day);
    return shifts.filter(
      (s) => s.staffMemberId === staffId && toDateKey(s.date) === key
    );
  };

  const staffWeeklyHours = (staffId: string) =>
    shifts
      .filter((s) => s.staffMemberId === staffId)
      .reduce((sum, s) => sum + shiftDurationHours(s.startTime, s.endTime), 0);

  const openCreate = (staffMemberId: string, date: Date) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      staffMemberId,
      date: toDateKey(date),
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setForm({
      staffMemberId: shift.staffMemberId,
      date: toDateKey(shift.date),
      startTime: shift.startTime,
      endTime: shift.endTime,
      workRole: shift.workRole || "",
      notes: shift.notes || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const applyPreset = (startTime: string, endTime: string) => {
    setForm((f) => ({ ...f, startTime, endTime }));
  };

  const handleSave = async () => {
    if (!form.staffMemberId || !form.date) {
      setError("Staff and date are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        staffMemberId: form.staffMemberId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        workRole: form.workRole || null,
        notes: form.notes || null,
      };
      if (editing) {
        await apiPatch(`/api/schedule/${editing.id}`, payload);
      } else {
        await apiPost("/api/schedule", payload);
      }
      setModalOpen(false);
      fetchShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("Delete this shift?")) return;
    await apiDelete(`/api/schedule/${editing.id}`);
    setModalOpen(false);
    fetchShifts();
  };

  const copyPreviousWeek = async () => {
    setCopying(true);
    try {
      const res = await fetch("/api/schedule/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStart.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Copy failed");
      fetchShifts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  };

  const totalWeeklyHours = shifts.reduce(
    (sum, s) => sum + shiftDurationHours(s.startTime, s.endTime),
    0
  );

  if (activeStaff.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="Add staff to build a schedule"
        description="Create team members in the Team tab, then assign shifts here."
      />
    );
  }

  return (
    <>
      <LaborForecastPanel weekStart={weekStart} staff={activeStaff} onShiftAdded={fetchShifts} />

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setWeekStart((w) => addWeeksToDate(w, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-semibold text-slate-900">
            {formatWeekRange(weekStart)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setWeekStart((w) => addWeeksToDate(w, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(getWeekStart())}
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {totalWeeklyHours.toFixed(1)} hrs scheduled
          </span>
          <Button variant="secondary" size="sm" onClick={copyPreviousWeek} disabled={copying}>
            <Copy className="h-4 w-4" />
            {copying ? "Copying..." : "Copy last week"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm, staffMemberId: activeStaff[0]?.id || "" });
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add shift
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-medium text-slate-500">
                Staff
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className="min-w-[100px] px-2 py-3 text-center font-medium text-slate-500"
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="text-xs font-normal text-slate-400">
                    {format(day, "MMM d")}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium text-slate-500">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Loading schedule...
                </td>
              </tr>
            ) : (
              activeStaff.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 border-r bg-white px-4 py-3">
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </td>
                  {weekDays.map((day) => {
                    const cellShifts = getShiftsForCell(member.id, day);
                    return (
                      <td key={day.toISOString()} className="px-1 py-2 align-top">
                        <div className="flex min-h-[64px] flex-col gap-1">
                          {cellShifts.map((shift) => (
                            <button
                              key={shift.id}
                              type="button"
                              onClick={() => openEdit(shift)}
                              className={cn(
                                "rounded-md border px-2 py-1.5 text-left text-xs transition-opacity hover:opacity-80",
                                roleColor(shift.workRole || member.role)
                              )}
                            >
                              <div className="font-medium">
                                {formatShiftTime(shift.startTime, shift.endTime)}
                              </div>
                              {shift.workRole && shift.workRole !== member.role && (
                                <div className="text-[10px] opacity-80">as {shift.workRole}</div>
                              )}
                              {shift.notes && (
                                <div className="mt-0.5 truncate opacity-75">{shift.notes}</div>
                              )}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => openCreate(member.id, day)}
                            className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 py-2 text-slate-300 hover:border-orange-300 hover:text-orange-400"
                            title="Add shift"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right font-medium text-slate-700">
                    {staffWeeklyHours(member.id).toFixed(1)}h
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Shift" : "Add Shift"}
      >
        <div className="space-y-4">
          <FormField label="Staff member">
            <Select
              value={form.staffMemberId}
              onChange={(e) => setForm({ ...form, staffMemberId: e.target.value })}
            >
              <option value="">Select...</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </FormField>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {SHIFT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.startTime, p.endTime)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-orange-100 hover:text-orange-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start time">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </FormField>
            <FormField label="End time">
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Role worked this shift (dual-rate pay)">
            <Select
              value={form.workRole}
              onChange={(e) => setForm({ ...form, workRole: e.target.value })}
            >
              <option value="">Default ({activeStaff.find((s) => s.id === form.staffMemberId)?.role ?? "staff role"})</option>
              {JOB_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>
          {form.startTime && form.endTime && (
            <p className="text-sm text-slate-500">
              Duration: {shiftDurationHours(form.startTime, form.endTime).toFixed(1)} hours
            </p>
          )}
          <FormField label="Notes (optional)">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Section, station, break info..."
            />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between gap-2">
            {editing ? (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save shift"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

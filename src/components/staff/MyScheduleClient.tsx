"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import {
  getWeekStart,
  getWeekDays,
  formatWeekRange,
  formatShiftTime,
  addWeeksToDate,
  roleColor,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  workRole: string | null;
  notes: string | null;
}

export function MyScheduleClient() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule/my?weekStart=${weekStart.toISOString()}`);
      const data = await res.json();
      setShifts(data.shifts || []);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const weekDays = getWeekDays(weekStart);

  return (
    <PageSectionShell pageId="my-schedule">
      <PageSection
        id="my-schedule-week"
        title="My schedule"
        defaultOpen
        headerActions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addWeeksToDate(w, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-semibold">{formatWeekRange(weekStart)}</span>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addWeeksToDate(w, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading your schedule…</p>
        ) : shifts.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-12 w-12" />}
            title="No shifts this week"
            description="Your manager will publish your schedule here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weekDays.map((day) => {
              const dayShifts = shifts.filter(
                (s) => format(new Date(s.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
              );
              return (
                <div key={day.toISOString()} className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{format(day, "EEE, MMM d")}</p>
                  {dayShifts.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">Off</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {dayShifts.map((s) => (
                        <li
                          key={s.id}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm",
                            roleColor(s.workRole || "Server")
                          )}
                        >
                          <p className="font-medium">{formatShiftTime(s.startTime, s.endTime)}</p>
                          {s.workRole && <p className="text-xs opacity-80">{s.workRole}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageSection>
    </PageSectionShell>
  );
}

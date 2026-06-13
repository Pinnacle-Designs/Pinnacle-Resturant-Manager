"use client";

import { useState } from "react";
import { Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { StaffClient } from "@/components/staff/StaffClient";
import { ScheduleClient } from "@/components/staff/ScheduleClient";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  hourlyRate?: number;
  active: boolean;
}

type Tab = "team" | "schedule";

export function StaffPageClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const { can } = useAuth();
  const canEdit = can("edit_staff");
  const canSchedule = can("manage_schedule");

  const defaultTab: Tab = canSchedule ? "schedule" : "team";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [staff, setStaff] = useState(initialStaff);

  const tabs = (
    [
      { id: "schedule" as Tab, label: "Schedule", icon: Calendar, show: canSchedule },
      { id: "team" as Tab, label: "Team", icon: Users, show: true },
    ] as { id: Tab; label: string; icon: typeof Users; show: boolean }[]
  ).filter((t) => t.show);

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-6 flex gap-1 rounded-lg border bg-white p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none",
                tab === id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "schedule" && canSchedule ? (
        <ScheduleClient staff={staff} />
      ) : (
        <StaffClient initialStaff={staff} onStaffChange={setStaff} canEdit={canEdit} />
      )}
    </div>
  );
}

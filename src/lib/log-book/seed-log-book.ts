import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { buildLogBookSearchText, startOfBusinessDay } from "./utils";

export async function seedLogBookSample(locationId: string) {
  const staff = await prisma.staffMember.findMany({
    where: { locationId, active: true },
    take: 5,
  });
  if (staff.length === 0) return;

  const existing = await prisma.logBookEntry.count({ where: { locationId } });
  if (existing > 0) return;

  const priya = staff.find((s) => s.name.includes("Priya")) ?? staff[0];
  const marcus = staff.find((s) => s.name.includes("Marcus")) ?? staff[1] ?? staff[0];
  const elena = staff.find((s) => s.name.includes("Elena")) ?? staff[2] ?? staff[0];

  const days = [0, 1, 2, 3].map((n) => startOfBusinessDay(subDays(new Date(), n)));

  const samples = [
    {
      logDate: days[0],
      category: "SALES" as const,
      title: "Strong Friday dinner",
      content:
        "Dinner paced 12% above last Friday. Bar held 45-minute wait from 6:30–8:00. No large walk-offs. Catering pickup at 5 PM went smoothly.",
      salesTotal: 8420,
      guestCount: 186,
      laborHours: 42,
      staffingNote: "Fully staffed — one server called out, Priya picked up an extra section.",
      mentions: [priya],
      pinned: true,
    },
    {
      logDate: days[0],
      category: "STAFF" as const,
      title: "Coaching note — Priya",
      content:
        "Priya handled a difficult table comp gracefully. Reminded her to involve a manager before issuing comps over $25. Overall excellent service recovery.",
      mentions: [priya],
    },
    {
      logDate: days[0],
      category: "MAINTENANCE" as const,
      content:
        "Walk-in cooler temp alarm at 2 PM — settled after door gasket adjustment. Scheduled HVAC vendor for Tuesday AM. Do not overload right-side shelves.",
      maintenanceNote: "HVAC vendor Tuesday 8 AM; monitor walk-in overnight.",
    },
    {
      logDate: days[1],
      category: "STAFFING" as const,
      content:
        "Lunch understaffed — Marcus covered expo and grill for 90 minutes. Need a backup line cook on Wednesdays. OT risk for Marcus if pattern continues.",
      laborHours: 38,
      staffingNote: "Wednesday lunch: add 1 line cook to template.",
      mentions: [marcus],
    },
    {
      logDate: days[1],
      category: "GUEST" as const,
      content:
        "Guest allergy incident avoided — Elena caught undeclared dairy on a modifier. Ticket re-fired correctly. Guest thanked kitchen on way out.",
      mentions: [elena],
    },
    {
      logDate: days[2],
      category: "OPERATIONS" as const,
      content:
        "POS sync lag during lunch — 3-minute delay on KDS. Restarted expo tablet. IT ticket opened if it happens again tomorrow.",
    },
    {
      logDate: days[3],
      category: "INVENTORY" as const,
      content:
        "Brisket 86 at 8:15 PM Saturday. Sysco delivery shorted ribs — adjusted pars for weekend. Waste log updated for trim loss.",
    },
  ];

  for (const sample of samples) {
    const mentionLabels = (sample.mentions ?? []).map((m) => m.name);
    await prisma.logBookEntry.create({
      data: {
        locationId,
        logDate: sample.logDate,
        authorName: "Marcus Reed",
        category: sample.category,
        title: sample.title ?? null,
        content: sample.content,
        searchText: buildLogBookSearchText({
          title: sample.title,
          content: sample.content,
          authorName: "Marcus Reed",
          category: sample.category,
          staffingNote: sample.staffingNote,
          maintenanceNote: sample.maintenanceNote,
          mentionLabels,
        }),
        salesTotal: sample.salesTotal ?? null,
        guestCount: sample.guestCount ?? null,
        laborHours: sample.laborHours ?? null,
        staffingNote: sample.staffingNote ?? null,
        maintenanceNote: sample.maintenanceNote ?? null,
        pinned: sample.pinned ?? false,
        mentions: {
          create: (sample.mentions ?? []).map((m) => ({
            staffMemberId: m.id,
            mentionLabel: m.name,
          })),
        },
      },
    });
  }
}

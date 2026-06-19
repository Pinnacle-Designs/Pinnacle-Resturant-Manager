import { prisma } from "@/lib/prisma";
import { fetchWithTimeout } from "./fetch-timeout";
import { startOfDayInTimezone, dateKeyInTimezone } from "@/lib/location/time";
import type { LocationGeoInput } from "@/lib/location/geo";

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  types: string[];
}

function defaultHolidayImpact(name: string): number {
  if (/thanksgiving|christmas|new year|independence|july 4|memorial|labor day|easter|presidents|martin luther|veterans|columbus|juneteenth/i.test(name)) {
    return 25;
  }
  return 12;
}

async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<NagerHoliday[]> {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`;
    const res = await fetchWithTimeout(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    return (await res.json()) as NagerHoliday[];
  } catch {
    return [];
  }
}

/** Sync public holidays for the location's country into ExternalFactor rows. */
export async function syncHolidayCalendar(
  locationId: string,
  location: LocationGeoInput
) {
  const countryCode = (location.countryCode ?? "US").toUpperCase();
  const timeZone = location.timezone ?? "America/New_York";

  const recent = await prisma.externalFactor.findFirst({
    where: {
      locationId,
      factorType: "holiday",
      description: { startsWith: "Holiday:" },
      createdAt: { gte: new Date(Date.now() - SYNC_COOLDOWN_MS) },
    },
  });
  if (recent) {
    return { synced: false, reason: "recent_sync", count: 0 };
  }

  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];
  const holidays: NagerHoliday[] = [];
  for (const year of years) {
    holidays.push(...(await fetchPublicHolidays(countryCode, year)));
  }

  const todayKey = dateKeyInTimezone(now, timeZone);
  const upcoming = holidays.filter((h) => h.date >= todayKey);

  await prisma.externalFactor.deleteMany({
    where: {
      locationId,
      factorType: "holiday",
      description: { startsWith: "Holiday:" },
      date: { gte: startOfDayInTimezone(now, timeZone) },
    },
  });

  let count = 0;
  for (const h of upcoming) {
    const date = startOfDayInTimezone(new Date(`${h.date}T12:00:00`), timeZone);
    const label = h.localName || h.name;
    await prisma.externalFactor.create({
      data: {
        locationId,
        date,
        factorType: "holiday",
        description: `Holiday: ${label}${h.global ? "" : " (regional)"} — ${countryCode}`,
        impactPct: defaultHolidayImpact(label),
      },
    });
    count += 1;
  }

  return { synced: true, reason: "ok", count, countryCode };
}

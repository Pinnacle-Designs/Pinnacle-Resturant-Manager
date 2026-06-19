import { prisma } from "@/lib/prisma";
import { resolveLocationGeo, type LocationGeoInput } from "@/lib/location/geo";
import { startOfDayInTimezone } from "@/lib/location/time";
import { fetchWeatherForecast } from "./weather";
import { syncHolidayCalendar } from "./sync-holidays";
import { weatherMeasurementSystem, type LocationLocaleSettings } from "@/lib/location/locale";

const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Sync 7-day weather forecast into ExternalFactor records. */
export async function syncWeatherForecasts(
  locationId: string,
  location: LocationGeoInput & {
    measurementSystem?: string | null;
    volumeStandard?: string | null;
    countryCode?: string;
  }
) {
  const recent = await prisma.externalFactor.findFirst({
    where: {
      locationId,
      factorType: "weather",
      description: { startsWith: "Forecast:" },
      createdAt: { gte: new Date(Date.now() - SYNC_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return { synced: false, reason: "recent_sync", source: null as string | null };
  }

  const geo = await resolveLocationGeo(location);
  if (!geo) {
    return { synced: false, reason: "geocode_failed", source: null };
  }

  const timeZone = geo.timezone ?? location.timezone ?? "America/New_York";
  const localeSettings: LocationLocaleSettings = {
    currencyCode: "USD",
    locale: "en-US",
    measurementSystem:
      location.measurementSystem === "metric" || location.measurementSystem === "mixed"
        ? location.measurementSystem
        : "imperial",
    volumeStandard:
      location.volumeStandard === "uk" || location.volumeStandard === "metric"
        ? location.volumeStandard
        : "us",
  };
  const measurementSystem = weatherMeasurementSystem(localeSettings);
  const { source, forecasts } = await fetchWeatherForecast(geo.lat, geo.lon, measurementSystem);
  const today = startOfDayInTimezone(new Date(), timeZone);

  await prisma.externalFactor.deleteMany({
    where: {
      locationId,
      factorType: "weather",
      description: { startsWith: "Forecast:" },
      date: { gte: today },
    },
  });

  for (const f of forecasts) {
    const date = startOfDayInTimezone(new Date(`${f.date}T12:00:00`), timeZone);
    const impactPct = f.isRainy ? 25 : f.precipitationPct > 40 ? 15 : 0;
    await prisma.externalFactor.create({
      data: {
        locationId,
        date,
        factorType: "weather",
        description: `Forecast: ${f.condition} (${f.precipitationPct}% precip) — ${geo.label} via ${source}`,
        impactPct,
      },
    });
  }

  return { synced: true, reason: "ok", source, count: forecasts.length, geo: geo.label };
}

/** Weather + holidays — called from analytics, Crystal Ball, and location save. */
export async function syncExternalFactorsForLocation(
  locationId: string,
  location: LocationGeoInput & {
    measurementSystem?: string | null;
    volumeStandard?: string | null;
    countryCode?: string;
  }
) {
  const [weather, holidays] = await Promise.all([
    syncWeatherForecasts(locationId, location),
    syncHolidayCalendar(locationId, location),
  ]);
  return { weather, holidays };
}

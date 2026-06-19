import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { resolveLocationGeo } from "@/lib/location/geo";
import { dateKeyInTimezone } from "@/lib/location/time";
import { fetchWeatherForecast } from "@/lib/external/weather";
import {
  learnExternalPatterns,
  normalizeFactorCategory,
} from "@/lib/external/pattern-learning";
import type { WeatherForecastDay } from "@/lib/analytics/types";

export interface DayForecastOverlay {
  date: string;
  condition: string;
  precipitationPct: number;
  isRainy: boolean;
  salesMultiplier: number;
  prepMultiplier: number;
  parMultiplier: number;
  drivers: string[];
}

export interface ForecastOverlayReport {
  weatherSource: string;
  geoLabel: string | null;
  timezone: string | null;
  localTime: string | null;
  learnedPatternCount: number;
  upcomingEvents: Array<{ date: string; description: string; impactPct: number }>;
  dailyOverlays: DayForecastOverlay[];
  summary: string;
}

function applyWeatherMultiplier(day: WeatherForecastDay, rainImpactPct: number): number {
  if (day.isRainy || day.precipitationPct >= 50) {
    return 1 + rainImpactPct / 100;
  }
  if (day.precipitationPct >= 30) {
    return 1 + (rainImpactPct / 100) * 0.5;
  }
  if (day.tempHigh >= 78 && day.precipitationPct < 20) {
    return 1.12;
  }
  return 1;
}

export async function computeForecastOverlay(locationId: string): Promise<ForecastOverlayReport> {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new Error("Location not found");

  const since = addDays(new Date(), -60);
  const [orders, externalFactors, upcomingFactors] = await Promise.all([
    prisma.order.findMany({
      where: { locationId, status: "PAID", createdAt: { gte: since } },
      select: {
        createdAt: true,
        channel: true,
        guestCount: true,
        totalAmount: true,
        discountAmount: true,
        compAmount: true,
        voidAmount: true,
      },
    }),
    prisma.externalFactor.findMany({
      where: { locationId, date: { gte: since } },
    }),
    prisma.externalFactor.findMany({
      where: { locationId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 10,
    }),
  ]);

  const learned = learnExternalPatterns(
    orders,
    externalFactors.map((f) => ({
      date: f.date,
      factorType: f.factorType,
      description: f.description,
      impactPct: f.impactPct,
    }))
  );

  const rainPattern = learned.find((p) => p.category === "weather" && p.metric === "delivery");
  const rainImpactPct = rainPattern?.impactPct ?? 25;
  const eventImpactPct =
    learned.find((p) => p.category === "event" && p.metric === "sales")?.impactPct ?? 20;

  let weatherSource = "unavailable";
  let geoLabel: string | null = null;
  let forecast: WeatherForecastDay[] = [];

  const geo = await resolveLocationGeo(location);
  const timeZone = geo?.timezone ?? location.timezone ?? null;

  if (geo) {
    geoLabel = geo.label;
    const w = await fetchWeatherForecast(geo.lat, geo.lon);
    weatherSource = w.source;
    forecast = w.forecasts;
  }

  const eventByDate = new Map(
    upcomingFactors.map((f) => [
      timeZone ? dateKeyInTimezone(f.date, timeZone) : f.date.toISOString().split("T")[0]!,
      f,
    ])
  );

  const dailyOverlays: DayForecastOverlay[] = forecast.map((day) => {
    const drivers: string[] = [];
    let multiplier = applyWeatherMultiplier(day, rainImpactPct);

    if (day.isRainy || day.precipitationPct >= 40) {
      drivers.push(`Rain ${day.precipitationPct}% — boost delivery prep, trim patio pars`);
    } else if (day.tempHigh >= 75 && day.precipitationPct < 25) {
      drivers.push("Sunny/warm — patio & cold drink demand likely up");
      multiplier = Math.max(multiplier, 1.1);
    }

    const event = eventByDate.get(day.date);
    if (event) {
      const boost = 1 + event.impactPct / 100;
      multiplier *= boost;
      drivers.push(`Event: ${event.description} (+${event.impactPct}%)`);
    }

    const holidayFactor = upcomingFactors.find((f) => {
      const fKey = timeZone ? dateKeyInTimezone(f.date, timeZone) : f.date.toISOString().split("T")[0];
      return (
        fKey === day.date &&
        normalizeFactorCategory(f.factorType, f.description) === "holiday"
      );
    });
    if (holidayFactor) {
      multiplier *= 1 + holidayFactor.impactPct / 100;
      drivers.push(`Holiday lift: ${holidayFactor.description}`);
    }

    multiplier = Math.round(multiplier * 100) / 100;

    return {
      date: day.date,
      condition: day.condition,
      precipitationPct: day.precipitationPct,
      isRainy: day.isRainy,
      salesMultiplier: multiplier,
      prepMultiplier: multiplier,
      parMultiplier: Math.min(multiplier, 1.35),
      drivers: drivers.length ? drivers : ["Baseline forecast"],
    };
  });

  return {
    weatherSource,
    geoLabel,
    timezone: timeZone,
    localTime: timeZone
      ? new Intl.DateTimeFormat("en-US", {
          timeZone,
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())
      : null,
    learnedPatternCount: learned.length,
    upcomingEvents: upcomingFactors.map((f) => ({
      date: f.date.toISOString().split("T")[0]!,
      description: f.description,
      impactPct: f.impactPct,
    })),
    dailyOverlays,
    summary:
      dailyOverlays.some((d) => d.isRainy)
        ? "Rain in forecast — adjust prep and par levels for delivery-heavy days"
        : eventImpactPct > 15
          ? "Local events historically lift sales — review suggested orders"
          : "7-day overlay ready — weather and events applied to prep & par suggestions",
  };
}

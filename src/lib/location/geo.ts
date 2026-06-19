import type { Location } from "@prisma/client";
import {
  geocodeStructured,
  type GeoPoint,
} from "@/lib/external/geocode";
import { fetchWithTimeout } from "@/lib/external/fetch-timeout";

export type LocationGeoInput = Pick<
  Location,
  | "name"
  | "address"
  | "postalCode"
  | "city"
  | "stateProvince"
  | "countryCode"
  | "latitude"
  | "longitude"
  | "timezone"
>;

export interface ResolvedGeo {
  lat: number;
  lon: number;
  label: string;
  timezone: string | null;
  source: "stored" | "geocoded";
}

export async function fetchTimezoneFromCoords(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto&forecast_days=1`;
    const res = await fetchWithTimeout(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { timezone?: string };
    return data.timezone ?? null;
  } catch {
    return null;
  }
}

function geoLabelFromLocation(loc: LocationGeoInput): string {
  return [
    loc.city,
    loc.stateProvince,
    loc.postalCode,
    loc.countryCode !== "US" ? loc.countryCode : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Resolve coordinates: stored lat/lng first, then geocode from postal/address. */
export async function resolveLocationGeo(
  loc: LocationGeoInput
): Promise<ResolvedGeo | null> {
  if (loc.latitude != null && loc.longitude != null) {
    const tz =
      loc.timezone ?? (await fetchTimezoneFromCoords(loc.latitude, loc.longitude));
    return {
      lat: loc.latitude,
      lon: loc.longitude,
      label: geoLabelFromLocation(loc) || loc.name,
      timezone: tz,
      source: "stored",
    };
  }

  const geocoded: GeoPoint | null = await geocodeStructured({
    name: loc.name,
    address: loc.address,
    postalCode: loc.postalCode,
    city: loc.city,
    stateProvince: loc.stateProvince,
    countryCode: loc.countryCode ?? "US",
  });

  if (!geocoded) return null;

  const tz = await fetchTimezoneFromCoords(geocoded.lat, geocoded.lon);
  return {
    lat: geocoded.lat,
    lon: geocoded.lon,
    label: geocoded.label,
    timezone: tz,
    source: "geocoded",
  };
}

export interface SyncGeoResult {
  latitude: number;
  longitude: number;
  timezone: string | null;
  geoLabel: string;
}

/** Geocode from postal/address and return fields to persist on Location. */
export async function syncLocationGeoFields(
  loc: LocationGeoInput
): Promise<SyncGeoResult | null> {
  const resolved = await resolveLocationGeo(loc);
  if (!resolved) return null;
  return {
    latitude: resolved.lat,
    longitude: resolved.lon,
    timezone: resolved.timezone,
    geoLabel: resolved.label,
  };
}

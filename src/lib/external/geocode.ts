import { fetchWithTimeout } from "./fetch-timeout";

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

export interface StructuredAddress {
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  countryCode?: string;
}

function countryLabel(code: string): string {
  if (code === "US") return "United States";
  if (code === "CA") return "Canada";
  if (code === "GB") return "United Kingdom";
  if (code === "AU") return "Australia";
  return code;
}

function normalizePostal(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function postalMatchesResult(requested: string, hit: GeocodeHit): boolean {
  const zip = normalizePostal(requested);
  const postcodes = hit.postcodes ?? (hit.postcode ? [hit.postcode] : []);
  if (postcodes.length === 0) return true;
  return postcodes.some((p) => {
    const pc = normalizePostal(String(p));
    return pc === zip || pc.startsWith(zip) || zip.startsWith(pc);
  });
}

interface GeocodeHit {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  postcodes?: string[];
}

function hitToPoint(hit: GeocodeHit, postalCode?: string | null): GeoPoint {
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    label: [hit.name, hit.admin1, postalCode ?? hit.postcode, hit.country].filter(Boolean).join(", "),
    city: hit.name ?? null,
    stateProvince: hit.admin1 ?? null,
    postalCode: postalCode ?? hit.postcode ?? null,
    countryCode: hit.country_code ?? null,
  };
}

/** Build geocode search queries — postal/ZIP first for accuracy. */
export function buildGeocodeQueries(input: StructuredAddress): string[] {
  const cc = input.countryCode ?? "US";
  const country = countryLabel(cc);
  const queries: string[] = [];

  if (input.postalCode?.trim()) {
    const zip = input.postalCode.trim();
    queries.push([zip, country].join(", "));
    if (input.city?.trim() || input.stateProvince?.trim()) {
      queries.push(
        [zip, input.city, input.stateProvince, country].filter(Boolean).join(", ")
      );
    }
  }

  if (!input.postalCode?.trim()) {
    if (input.city?.trim() && input.stateProvince?.trim()) {
      queries.push([input.city, input.stateProvince, country].filter(Boolean).join(", "));
    }
    if (input.address?.trim()) {
      queries.push(
        [input.address, input.city, input.stateProvince, country].filter(Boolean).join(", ")
      );
    }
    queries.push(
      [input.address, input.name].filter(Boolean).join(", "),
      input.name,
      input.address ?? ""
    );
  }

  return [...new Set(queries.filter((q) => q.trim().length > 2))];
}

async function searchGeocode(
  query: string,
  options?: { postalCode?: string | null }
): Promise<GeoPoint | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const results = data.results ?? [];
    const zip = options?.postalCode?.trim();
    const hit = zip
      ? results.find((r) => postalMatchesResult(zip, r)) ?? results[0]
      : results[0];
    if (!hit) return null;
    if (zip && !postalMatchesResult(zip, hit)) return null;
    return hitToPoint(hit, zip);
  } catch {
    return null;
  }
}

/** Zippopotam.us — precise lat/lng for US/CA postal codes. */
async function geocodePostalViaZippopotam(
  postalCode: string,
  countryCode: string
): Promise<GeoPoint | null> {
  const cc = countryCode.toLowerCase();
  if (!["us", "ca", "mx", "gb", "de", "fr", "es", "it", "au", "nz", "jp", "br"].includes(cc)) {
    return null;
  }
  const zip = postalCode.trim();
  try {
    const url = `https://api.zippopotam.us/${cc}/${encodeURIComponent(zip)}`;
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      country?: string;
      "post code"?: string;
      places?: Array<{
        latitude: string;
        longitude: string;
        "place name"?: string;
        "state abbreviation"?: string;
        state?: string;
      }>;
    };
    const place = data.places?.[0];
    if (!place) return null;
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const city = place["place name"] ?? null;
    const state = place["state abbreviation"] ?? place.state ?? null;
    return {
      lat,
      lon,
      label: [city, state, data["post code"] ?? zip, data.country].filter(Boolean).join(", "),
      city,
      stateProvince: state,
      postalCode: data["post code"] ?? zip,
      countryCode: countryCode.toUpperCase(),
    };
  } catch {
    return null;
  }
}

/** Geocode using structured address — prefers postal code and validates the match. */
export async function geocodeStructured(input: StructuredAddress): Promise<GeoPoint | null> {
  const cc = input.countryCode ?? "US";
  const zip = input.postalCode?.trim();

  if (zip) {
    const zippo = await geocodePostalViaZippopotam(zip, cc);
    if (zippo) return zippo;

    for (const query of buildGeocodeQueries(input)) {
      const hit = await searchGeocode(query, { postalCode: zip });
      if (hit) return hit;
    }
    return null;
  }

  for (const query of buildGeocodeQueries(input)) {
    const hit = await searchGeocode(query);
    if (hit) return hit;
  }
  return null;
}

/** Resolve a restaurant address to coordinates for weather APIs. */
export async function geocodeLocation(
  address: string | null | undefined,
  name: string,
  extras?: Partial<Omit<StructuredAddress, "name" | "address">>
): Promise<GeoPoint | null> {
  return geocodeStructured({
    name,
    address,
    postalCode: extras?.postalCode,
    city: extras?.city,
    stateProvince: extras?.stateProvince,
    countryCode: extras?.countryCode ?? "US",
  });
}

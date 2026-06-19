import { fetchWithTimeout } from "./fetch-timeout";

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
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

/** Build geocode search queries — postal/ZIP first for accuracy. */
export function buildGeocodeQueries(input: StructuredAddress): string[] {
  const cc = input.countryCode ?? "US";
  const country = countryLabel(cc);
  const queries: string[] = [];

  if (input.postalCode?.trim()) {
    const zip = input.postalCode.trim();
    queries.push(
      [zip, input.city, input.stateProvince, country].filter(Boolean).join(", "),
      [zip, country].join(", ")
    );
  }

  if (input.city?.trim() && input.stateProvince?.trim()) {
    queries.push([input.city, input.stateProvince, country].filter(Boolean).join(", "));
  }

  if (input.address?.trim()) {
    queries.push(
      [input.address, input.postalCode, input.city, input.stateProvince, country]
        .filter(Boolean)
        .join(", ")
    );
  }

  queries.push(
    [input.address, input.name].filter(Boolean).join(", "),
    input.name,
    input.address ?? ""
  );

  return [...new Set(queries.filter((q) => q.trim().length > 2))];
}

async function searchGeocode(query: string): Promise<GeoPoint | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetchWithTimeout(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        latitude: number;
        longitude: number;
        name: string;
        admin1?: string;
        country?: string;
        postcode?: string;
      }>;
    };
    const hit = data.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.latitude,
      lon: hit.longitude,
      label: [hit.name, hit.admin1, hit.postcode, hit.country].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
}

/** Geocode using structured address — prefers postal code. */
export async function geocodeStructured(input: StructuredAddress): Promise<GeoPoint | null> {
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

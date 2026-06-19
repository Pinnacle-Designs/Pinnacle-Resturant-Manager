/** Regional settings derived from country / postal code. */

export type MeasurementSystem = "imperial" | "metric";

export interface LocationLocaleSettings {
  currencyCode: string;
  measurementSystem: MeasurementSystem;
  locale: string;
}

export const DEFAULT_LOCALE_SETTINGS: LocationLocaleSettings = {
  currencyCode: "USD",
  measurementSystem: "imperial",
  locale: "en-US",
};

/** ISO 3166-1 alpha-2 → currency, units, and formatting locale. */
const COUNTRY_LOCALE: Record<string, LocationLocaleSettings> = {
  US: { currencyCode: "USD", measurementSystem: "imperial", locale: "en-US" },
  CA: { currencyCode: "CAD", measurementSystem: "metric", locale: "en-CA" },
  GB: { currencyCode: "GBP", measurementSystem: "metric", locale: "en-GB" },
  AU: { currencyCode: "AUD", measurementSystem: "metric", locale: "en-AU" },
  NZ: { currencyCode: "NZD", measurementSystem: "metric", locale: "en-NZ" },
  MX: { currencyCode: "MXN", measurementSystem: "metric", locale: "es-MX" },
  IE: { currencyCode: "EUR", measurementSystem: "metric", locale: "en-IE" },
  FR: { currencyCode: "EUR", measurementSystem: "metric", locale: "fr-FR" },
  DE: { currencyCode: "EUR", measurementSystem: "metric", locale: "de-DE" },
  ES: { currencyCode: "EUR", measurementSystem: "metric", locale: "es-ES" },
  IT: { currencyCode: "EUR", measurementSystem: "metric", locale: "it-IT" },
  NL: { currencyCode: "EUR", measurementSystem: "metric", locale: "nl-NL" },
  BE: { currencyCode: "EUR", measurementSystem: "metric", locale: "nl-BE" },
  AT: { currencyCode: "EUR", measurementSystem: "metric", locale: "de-AT" },
  PT: { currencyCode: "EUR", measurementSystem: "metric", locale: "pt-PT" },
  CH: { currencyCode: "CHF", measurementSystem: "metric", locale: "de-CH" },
  SE: { currencyCode: "SEK", measurementSystem: "metric", locale: "sv-SE" },
  NO: { currencyCode: "NOK", measurementSystem: "metric", locale: "nb-NO" },
  DK: { currencyCode: "DKK", measurementSystem: "metric", locale: "da-DK" },
  FI: { currencyCode: "EUR", measurementSystem: "metric", locale: "fi-FI" },
  PL: { currencyCode: "PLN", measurementSystem: "metric", locale: "pl-PL" },
  JP: { currencyCode: "JPY", measurementSystem: "metric", locale: "ja-JP" },
  KR: { currencyCode: "KRW", measurementSystem: "metric", locale: "ko-KR" },
  CN: { currencyCode: "CNY", measurementSystem: "metric", locale: "zh-CN" },
  IN: { currencyCode: "INR", measurementSystem: "metric", locale: "en-IN" },
  SG: { currencyCode: "SGD", measurementSystem: "metric", locale: "en-SG" },
  HK: { currencyCode: "HKD", measurementSystem: "metric", locale: "en-HK" },
  AE: { currencyCode: "AED", measurementSystem: "metric", locale: "en-AE" },
  SA: { currencyCode: "SAR", measurementSystem: "metric", locale: "ar-SA" },
  BR: { currencyCode: "BRL", measurementSystem: "metric", locale: "pt-BR" },
  AR: { currencyCode: "ARS", measurementSystem: "metric", locale: "es-AR" },
  CL: { currencyCode: "CLP", measurementSystem: "metric", locale: "es-CL" },
  CO: { currencyCode: "COP", measurementSystem: "metric", locale: "es-CO" },
  ZA: { currencyCode: "ZAR", measurementSystem: "metric", locale: "en-ZA" },
  PH: { currencyCode: "PHP", measurementSystem: "metric", locale: "en-PH" },
  TH: { currencyCode: "THB", measurementSystem: "metric", locale: "th-TH" },
  MY: { currencyCode: "MYR", measurementSystem: "metric", locale: "ms-MY" },
  IL: { currencyCode: "ILS", measurementSystem: "metric", locale: "he-IL" },
  TR: { currencyCode: "TRY", measurementSystem: "metric", locale: "tr-TR" },
  /** Liberia uses imperial + USD */
  LR: { currencyCode: "USD", measurementSystem: "imperial", locale: "en-LR" },
};

/** Resolve currency, measurement system, and locale from a country code. */
export function resolveLocationLocale(countryCode?: string | null): LocationLocaleSettings {
  const cc = (countryCode ?? "US").trim().toUpperCase();
  return COUNTRY_LOCALE[cc] ?? { currencyCode: "USD", measurementSystem: "metric", locale: "en-US" };
}

export function defaultWeightUnit(system: MeasurementSystem): string {
  return system === "imperial" ? "lbs" : "kg";
}

export function defaultVolumeUnit(system: MeasurementSystem): string {
  return system === "imperial" ? "gal" : "L";
}

export function temperatureUnit(system: MeasurementSystem): "fahrenheit" | "celsius" {
  return system === "imperial" ? "fahrenheit" : "celsius";
}

export function formatCurrencyAmount(
  amount: number,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currencyCode,
    maximumFractionDigits: settings.currencyCode === "JPY" || settings.currencyCode === "KRW" ? 0 : 2,
  }).format(amount);
}

export function formatDateLocalized(
  date: Date | string,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  return new Intl.DateTimeFormat(settings.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: undefined,
  }).format(new Date(date));
}

export function formatWeightAmount(
  value: number,
  unit: string,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  const formatted = new Intl.NumberFormat(settings.locale, {
    maximumFractionDigits: unit === "kg" || unit === "lbs" ? 2 : 1,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function formatTemperatureAmount(
  celsius: number,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  if (settings.measurementSystem === "imperial") {
    const f = (celsius * 9) / 5 + 32;
    return `${Math.round(f)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

/** Client-side active locale — set by LocationLocaleProvider after load. */
let activeLocale: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS;

export function setActiveLocationLocale(settings: LocationLocaleSettings): void {
  activeLocale = settings;
}

export function getActiveLocationLocale(): LocationLocaleSettings {
  return activeLocale;
}

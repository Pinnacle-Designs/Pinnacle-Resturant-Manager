/** Regional settings derived from country / postal code. */

import {
  barcodeAiUnitList,
  defaultCountUnit,
  defaultLiquidUnit,
  defaultVolumeUnit,
  defaultWeightUnit,
  measurementSystemLabel,
  resolveMeasurementProfile,
  temperatureUnit,
  type LocaleMeasurementContext,
  type MeasurementProfile,
  type MeasurementSystem,
  type VolumeStandard,
} from "@/lib/location/measurements";

export type { MeasurementSystem, VolumeStandard, LocaleMeasurementContext, MeasurementProfile };

export interface LocationLocaleSettings extends LocaleMeasurementContext {
  currencyCode: string;
  locale: string;
}

export const DEFAULT_LOCALE_SETTINGS: LocationLocaleSettings = {
  currencyCode: "USD",
  measurementSystem: "imperial",
  volumeStandard: "us",
  locale: "en-US",
};

/** ISO 3166-1 alpha-2 → currency and BCP 47 locale (measurement from resolveMeasurementProfile). */
const COUNTRY_CURRENCY_LOCALE: Record<string, { currencyCode: string; locale: string }> = {
  US: { currencyCode: "USD", locale: "en-US" },
  CA: { currencyCode: "CAD", locale: "en-CA" },
  GB: { currencyCode: "GBP", locale: "en-GB" },
  AU: { currencyCode: "AUD", locale: "en-AU" },
  NZ: { currencyCode: "NZD", locale: "en-NZ" },
  MX: { currencyCode: "MXN", locale: "es-MX" },
  IE: { currencyCode: "EUR", locale: "en-IE" },
  FR: { currencyCode: "EUR", locale: "fr-FR" },
  DE: { currencyCode: "EUR", locale: "de-DE" },
  ES: { currencyCode: "EUR", locale: "es-ES" },
  IT: { currencyCode: "EUR", locale: "it-IT" },
  NL: { currencyCode: "EUR", locale: "nl-NL" },
  BE: { currencyCode: "EUR", locale: "nl-BE" },
  AT: { currencyCode: "EUR", locale: "de-AT" },
  PT: { currencyCode: "EUR", locale: "pt-PT" },
  CH: { currencyCode: "CHF", locale: "de-CH" },
  SE: { currencyCode: "SEK", locale: "sv-SE" },
  NO: { currencyCode: "NOK", locale: "nb-NO" },
  DK: { currencyCode: "DKK", locale: "da-DK" },
  FI: { currencyCode: "EUR", locale: "fi-FI" },
  PL: { currencyCode: "PLN", locale: "pl-PL" },
  JP: { currencyCode: "JPY", locale: "ja-JP" },
  KR: { currencyCode: "KRW", locale: "ko-KR" },
  CN: { currencyCode: "CNY", locale: "zh-CN" },
  IN: { currencyCode: "INR", locale: "en-IN" },
  SG: { currencyCode: "SGD", locale: "en-SG" },
  HK: { currencyCode: "HKD", locale: "en-HK" },
  AE: { currencyCode: "AED", locale: "en-AE" },
  SA: { currencyCode: "SAR", locale: "ar-SA" },
  BR: { currencyCode: "BRL", locale: "pt-BR" },
  AR: { currencyCode: "ARS", locale: "es-AR" },
  CL: { currencyCode: "CLP", locale: "es-CL" },
  CO: { currencyCode: "COP", locale: "es-CO" },
  ZA: { currencyCode: "ZAR", locale: "en-ZA" },
  PH: { currencyCode: "PHP", locale: "en-PH" },
  TH: { currencyCode: "THB", locale: "th-TH" },
  MY: { currencyCode: "MYR", locale: "ms-MY" },
  IL: { currencyCode: "ILS", locale: "he-IL" },
  TR: { currencyCode: "TRY", locale: "tr-TR" },
  LR: { currencyCode: "USD", locale: "en-LR" },
  MM: { currencyCode: "MMK", locale: "my-MM" },
  IM: { currencyCode: "GBP", locale: "en-GB" },
  GG: { currencyCode: "GBP", locale: "en-GB" },
  JE: { currencyCode: "GBP", locale: "en-GB" },
  // Additional metric-major markets
  VN: { currencyCode: "VND", locale: "vi-VN" },
  ID: { currencyCode: "IDR", locale: "id-ID" },
  EG: { currencyCode: "EGP", locale: "ar-EG" },
  NG: { currencyCode: "NGN", locale: "en-NG" },
  KE: { currencyCode: "KES", locale: "en-KE" },
  PK: { currencyCode: "PKR", locale: "en-PK" },
  BD: { currencyCode: "BDT", locale: "bn-BD" },
  RU: { currencyCode: "RUB", locale: "ru-RU" },
  UA: { currencyCode: "UAH", locale: "uk-UA" },
  RO: { currencyCode: "RON", locale: "ro-RO" },
  CZ: { currencyCode: "CZK", locale: "cs-CZ" },
  HU: { currencyCode: "HUF", locale: "hu-HU" },
  GR: { currencyCode: "EUR", locale: "el-GR" },
};

/** Resolve currency, measurement system, volume standard, and locale from country. */
export function resolveLocationLocale(countryCode?: string | null): LocationLocaleSettings {
  const cc = (countryCode ?? "US").trim().toUpperCase();
  const measurement = resolveMeasurementProfile(cc);
  const regional = COUNTRY_CURRENCY_LOCALE[cc] ?? { currencyCode: "USD", locale: "en-US" };
  return {
    currencyCode: regional.currencyCode,
    locale: regional.locale,
    ...measurement,
  };
}

export {
  defaultWeightUnit,
  defaultVolumeUnit,
  defaultLiquidUnit,
  defaultCountUnit,
  temperatureUnit,
  measurementSystemLabel,
  barcodeAiUnitList,
};

export function formatCurrencyAmount(
  amount: number,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currencyCode,
    maximumFractionDigits:
      settings.currencyCode === "JPY" ||
      settings.currencyCode === "KRW" ||
      settings.currencyCode === "VND"
        ? 0
        : 2,
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
    maximumFractionDigits: ["kg", "lbs", "lb", "L", "gal"].includes(unit) ? 2 : 1,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function formatTemperatureAmount(
  celsius: number,
  settings: LocationLocaleSettings = DEFAULT_LOCALE_SETTINGS
): string {
  if (temperatureUnit(settings) === "fahrenheit") {
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

export function weatherMeasurementSystem(
  settings: LocationLocaleSettings
): "imperial" | "metric" {
  return temperatureUnit(settings) === "fahrenheit" ? "imperial" : "metric";
}

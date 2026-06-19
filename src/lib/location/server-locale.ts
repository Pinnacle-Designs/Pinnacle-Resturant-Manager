import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOCALE_SETTINGS,
  resolveLocationLocale,
  type LocationLocaleSettings,
} from "@/lib/location/locale";
import { defaultWeightUnit } from "@/lib/location/measurements";

export async function getLocationLocaleSettings(
  locationId: string
): Promise<LocationLocaleSettings> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      countryCode: true,
      currencyCode: true,
      measurementSystem: true,
      volumeStandard: true,
      locale: true,
    },
  });
  if (!location) return DEFAULT_LOCALE_SETTINGS;

  const resolved = resolveLocationLocale(location.countryCode);
  return {
    currencyCode: location.currencyCode ?? resolved.currencyCode,
    measurementSystem:
      (location.measurementSystem as LocationLocaleSettings["measurementSystem"]) ??
      resolved.measurementSystem,
    volumeStandard:
      (location.volumeStandard as LocationLocaleSettings["volumeStandard"]) ??
      resolved.volumeStandard,
    locale: location.locale ?? resolved.locale,
  };
}

export async function defaultInventoryUnitForLocation(locationId: string): Promise<string> {
  const settings = await getLocationLocaleSettings(locationId);
  return defaultWeightUnit(settings);
}

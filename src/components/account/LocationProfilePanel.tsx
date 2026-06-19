"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, MapPin, RefreshCw, Coins, Ruler } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { Input, FormField } from "@/components/ui/form";
import { useLocationLocale } from "@/components/location/LocationLocaleProvider";

interface LocationProfile {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  seatCount: number;
  postalCode: string | null;
  city: string | null;
  stateProvince: string | null;
  countryCode: string;
  timezone: string | null;
  currencyCode: string;
  measurementSystem: string;
  locale: string;
  latitude: number | null;
  longitude: number | null;
}

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "MX", label: "Mexico" },
];

export function LocationProfilePanel() {
  const { refresh: refreshLocale } = useLocationLocale();
  const [location, setLocation] = useState<LocationProfile | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "warning">("success");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [seatCount, setSeatCount] = useState("40");

  const applyLocation = (loc: LocationProfile, time: string | null) => {
    setLocation(loc);
    setLocalTime(time);
    setName(loc.name ?? "");
    setAddress(loc.address ?? "");
    setPhone(loc.phone ?? "");
    setPostalCode(loc.postalCode ?? "");
    setCity(loc.city ?? "");
    setStateProvince(loc.stateProvince ?? "");
    setCountryCode(loc.countryCode ?? "US");
    setSeatCount(String(loc.seatCount ?? 40));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/locations/current");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load location");
      applyLocation(data.location, data.localTime ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/locations/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          phone,
          postalCode,
          city,
          stateProvince,
          countryCode,
          seatCount: Number(seatCount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      applyLocation(data.location, data.localTime ?? null);
      await refreshLocale();
      setMessageTone(data.geoResolved ? "success" : "warning");
      setMessage(
        data.geo?.label
          ? `${data.message ?? "Location saved"} (${data.geo.label})`
          : (data.message ?? "Location saved")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading location…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Set your postal code to auto-sync local time, currency, units, public holidays, and weather
        for Crystal Ball, analytics, and prep forecasts.
      </p>

      {(location?.timezone || localTime || location?.currencyCode) && (
        <div className="flex flex-wrap gap-2">
          {location?.currencyCode && (
            <Badge className="bg-amber-100 text-amber-900">
              <Coins className="mr-1 inline h-3.5 w-3.5" />
              {location.currencyCode}
            </Badge>
          )}
          {location?.measurementSystem && (
            <Badge className="bg-purple-100 text-purple-800">
              <Ruler className="mr-1 inline h-3.5 w-3.5" />
              {location.measurementSystem === "metric" ? "Metric (kg, °C)" : "Imperial (lbs, °F)"}
            </Badge>
          )}
          {location?.timezone && (
            <Badge className="bg-blue-100 text-blue-800">
              <Globe className="mr-1 inline h-3.5 w-3.5" />
              {location.timezone}
            </Badge>
          )}
          {localTime && (
            <Badge className="bg-slate-100 text-slate-700">Local time: {localTime}</Badge>
          )}
          {location?.latitude != null && location.longitude != null && (
            <Badge className="bg-green-100 text-green-800">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Badge>
          )}
        </div>
      )}

      <FormField label="Restaurant name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Street address">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </FormField>
        <FormField label="State / province">
          <Input value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} placeholder="TX" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Postal / ZIP code">
          <Input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="78701"
            inputMode="text"
          />
        </FormField>
        <FormField label="Country">
          <select
            className="input w-full"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Seats">
          <Input type="number" min={1} max={500} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
        </FormField>
      </div>

      {message && (
        <p className={`text-sm ${messageTone === "success" ? "text-green-700" : "text-amber-700"}`}>
          {message}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!location?.latitude && postalCode.trim() && (
        <p className="text-sm text-amber-700">
          Postal code not verified yet — update city, state, and country if needed, then save again.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Save & sync weather & holidays
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Select } from "@/components/ui/form";
import { useLocationLocale } from "@/components/location/LocationLocaleProvider";
import { getInventoryUnitOptions } from "@/lib/location/measurements";

interface UnitSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function UnitSelect({ value, onChange, className }: UnitSelectProps) {
  const { settings } = useLocationLocale();
  const options = getInventoryUnitOptions(settings);

  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {options
            .filter((o) => o.group === group)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}

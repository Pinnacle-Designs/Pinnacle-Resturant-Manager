"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField, Modal } from "@/components/ui/form";
import { apiPost } from "@/lib/api";
import { clientFetch } from "@/lib/embed-api-client";

interface Location {
  id: string;
  name: string;
  address: string | null;
}

export function LocationSwitcher() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clientFetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        setLocations(data.locations || []);
        setCurrentId(data.currentId || "");
      })
      .catch(console.error);
  }, []);

  const switchLocation = async (id: string) => {
    await clientFetch("/api/locations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: id }),
    });
    setCurrentId(id);
    window.location.reload();
  };

  const createLocation = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const loc = await apiPost<Location>("/api/locations", { name, address });
      setLocations((prev) => [...prev, loc]);
      setModalOpen(false);
      setName("");
      setAddress("");
      await switchLocation(loc.id);
    } finally {
      setSaving(false);
    }
  };

  if (locations.length === 0) return null;

  return (
    <>
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <MapPin className="h-3 w-3" />
          Location
        </div>
        <select
          value={currentId}
          onChange={(e) => switchLocation(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-2 flex w-full items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <Plus className="h-3 w-3" />
          Add location
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Location">
        <div className="space-y-4">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Branch" />
          </FormField>
          <FormField label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createLocation} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, LayoutGrid } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Input, Select, FormField, Modal } from "@/components/ui/form";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TableOrder {
  id: string;
  status: string;
}

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: string;
  orders: TableOrder[];
}

const STATUS_COLORS = {
  available: "bg-green-100 border-green-300 text-green-800",
  occupied: "bg-orange-100 border-orange-300 text-orange-800",
  reserved: "bg-blue-100 border-blue-300 text-blue-800",
};

export function TablesClient({ initialTables }: { initialTables: Table[] }) {
  const [tables, setTables] = useState(initialTables);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: "", capacity: "4", status: "available" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ number: "", capacity: "4", status: "available" });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (table: Table) => {
    setEditing(table);
    setForm({ number: String(table.number), capacity: String(table.capacity), status: table.status });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.number) {
      setError("Table number is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        number: parseInt(form.number),
        capacity: parseInt(form.capacity) || 4,
        status: form.status,
      };
      if (editing) {
        const updated = await apiPatch<Table>(`/api/tables/${editing.id}`, payload);
        setTables((prev) => prev.map((t) => (t.id === editing.id ? { ...updated, orders: editing.orders } : t)));
      } else {
        const created = await apiPost<Table>("/api/tables", payload);
        setTables((prev) => [...prev, { ...created, orders: [] }]);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    await apiDelete(`/api/tables/${id}`);
    setTables((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleStatus = async (table: Table) => {
    const next = table.status === "available" ? "occupied" : "available";
    const updated = await apiPatch<Table>(`/api/tables/${table.id}`, { status: next });
    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...updated, orders: t.orders } : t)));
  };

  const available = tables.filter((t) => t.status === "available").length;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  const reserved = tables.filter((t) => t.status === "reserved").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">{available} available</span>
          <span className="text-orange-600">{occupied} occupied</span>
          <span className="text-blue-600">{reserved} reserved</span>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Table
        </Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12" />}
          title="No tables configured"
          description="Set up your dining floor layout."
          action={<Button onClick={openCreate}>Add Table</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map((table) => (
            <div
              key={table.id}
              className={cn(
                "relative rounded-xl border-2 p-4 transition-all hover:shadow-md",
                STATUS_COLORS[table.status as keyof typeof STATUS_COLORS] || "bg-slate-50 border-slate-200"
              )}
            >
              <div className="text-center">
                <p className="text-2xl font-bold">{table.number}</p>
                <p className="text-xs opacity-75">{table.capacity} seats</p>
                <Badge className="mt-2 bg-white/50 text-xs capitalize">{table.status}</Badge>
                {table.orders.length > 0 && (
                  <p className="mt-1 text-xs font-medium">Active order</p>
                )}
              </div>
              <div className="mt-3 flex justify-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleStatus(table)}>
                  Toggle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(table)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(table.id)}>
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Table" : "Add Table"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Table Number">
              <Input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </FormField>
            <FormField label="Capacity">
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </Select>
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

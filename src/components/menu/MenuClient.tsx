"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Input, Select, Textarea, FormField, Modal } from "@/components/ui/form";
import { apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
}

interface MenuClientProps {
  initialItems: MenuItem[];
}

const CATEGORIES = ["Entrees", "Salads", "Pizza", "Desserts", "Beverages", "Appetizers", "Sides"];

export function MenuClient({ initialItems }: MenuClientProps) {
  const [items, setItems] = useState(initialItems);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "Entrees",
    available: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: "", category: "Entrees", available: true });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      category: item.category,
      available: item.available,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      setError("Name and price are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        category: form.category,
        available: form.available,
      };
      if (editing) {
        const updated = await apiPatch<MenuItem>(`/api/menu/${editing.id}`, payload);
        setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)));
      } else {
        const created = await apiPost<MenuItem>("/api/menu", payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    await apiDelete(`/api/menu/${id}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const grouped = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, MenuItem[]>
  );

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Utensils className="h-12 w-12" />}
          title="No menu items yet"
          description="Add your first menu item to get started."
          action={<Button onClick={openCreate}>Add Item</Button>}
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category}>
              <h2 className="mb-4 text-lg font-semibold text-slate-800">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryItems.map((item) => (
                  <div key={item.id} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        {item.description && (
                          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                        )}
                      </div>
                      <Badge
                        className={
                          item.available
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                    <p className="mt-4 text-xl font-bold text-orange-600">
                      {formatCurrency(item.price)}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Menu Item" : "Add Menu Item"}
      >
        <div className="space-y-4">
          <FormField label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price">
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </FormField>
            <FormField label="Category">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Availability">
            <Select
              value={form.available ? "true" : "false"}
              onChange={(e) => setForm({ ...form, available: e.target.value === "true" })}
            >
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </Select>
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

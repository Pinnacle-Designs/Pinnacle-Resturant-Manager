"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  CollapsibleGroup,
  CollapsibleGroupControls,
  CollapsibleSection,
} from "@/components/ui/Collapsible";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { Input, Select, Textarea, FormField, Modal } from "@/components/ui/form";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiDelete, apiPost } from "@/lib/api";
import { parseCategories } from "@/lib/pos/modifiers";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ModifierGroupRow {
  id: string;
  name: string;
  slug: string;
  categories: string | null;
  menuItemId: string | null;
  menuItem?: { id: string; name: string } | null;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

const MENU_CATEGORIES = [
  "Entrees",
  "Burgers",
  "Salads",
  "Pizza",
  "Appetizers",
  "Sides",
  "Desserts",
  "Beer",
  "Cocktails",
  "Beverages",
];

interface ModifierSetsClientProps {
  menuItems?: { id: string; name: string; category: string }[];
  embedded?: boolean;
}

export function ModifierSetsClient({ menuItems = [], embedded = false }: ModifierSetsClientProps) {
  const { can } = useAuth();
  const canManage = can("manage_menu");

  const [groups, setGroups] = useState<ModifierGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    categories: "Burgers",
    scope: "category" as "category" | "item",
    menuItemId: "",
    required: false,
    minSelect: "0",
    maxSelect: "4",
    options: "No Onions\nExtra Cheese\nAdd Bacon",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pos/modifiers");
      if (res.ok) setGroups(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  if (!canManage) return null;

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const options = form.options
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const minSelect = parseInt(form.minSelect, 10) || 0;
      const maxSelect = parseInt(form.maxSelect, 10) || 1;
      const created = await apiPost<ModifierGroupRow>("/api/pos/modifiers", {
        name: form.name,
        categories: form.scope === "category" ? form.categories : null,
        menuItemId: form.scope === "item" ? form.menuItemId || null : null,
        required: form.required,
        minSelect: form.required ? Math.max(1, minSelect) : minSelect,
        maxSelect,
        options,
      });
      setGroups((prev) => [...prev, created]);
      setModalOpen(false);
      setForm({
        name: "",
        categories: "Burgers",
        scope: "category",
        menuItemId: "",
        required: false,
        minSelect: "0",
        maxSelect: "4",
        options: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save modifier set");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this modifier set?")) return;
    await apiDelete(`/api/pos/modifiers/${id}`);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const listContent = loading ? (
    <p className="text-sm text-slate-500">Loading modifier sets…</p>
  ) : groups.length === 0 ? (
    <p className="text-sm text-slate-500">
      No modifier sets yet. Seed demo data or create a category group like &quot;Burger extras&quot;.
    </p>
  ) : (
    <CollapsibleGroup defaultExpanded="first" expandKey="modifier-sets-list">
      <CollapsibleGroupControls className="mb-3" />
      <div className="space-y-2">
        {groups.map((group, index) => {
          const cats = parseCategories(group.categories);
          const scopeLabel = group.menuItem
            ? `Item: ${group.menuItem.name}`
            : cats.length > 0
              ? `Category: ${cats.join(", ")}`
              : "All items";
          return (
            <CollapsibleSection
              key={group.id}
              id={`modifier-${group.id}`}
              title={group.name}
              description={scopeLabel}
              defaultOpen={index === 0}
              variant="plain"
              bodyClassName="!pt-2"
              headerActions={
                <Button variant="ghost" size="sm" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              }
            >
              <p className="text-xs text-slate-500">
                {group.required || group.minSelect > 0
                  ? "Forced on POS"
                  : "Optional extras"}
                {group.minSelect > 0 &&
                  ` · pick ${group.minSelect}${group.maxSelect !== group.minSelect ? `–${group.maxSelect}` : ""}`}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {group.options.map((o) => o.name).join(" · ")}
              </p>
            </CollapsibleSection>
          );
        })}
      </div>
    </CollapsibleGroup>
  );

  const newSetButton = (
    <Button
      onClick={() => {
        setError(null);
        setModalOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      New modifier set
    </Button>
  );

  return (
    <div className={embedded ? undefined : "mt-10"}>
      {embedded ? (
        <>
          <div className="mb-4 flex justify-end">{newSetButton}</div>
          {listContent}
        </>
      ) : (
        <PageSectionShell pageId="modifier-sets">
          <PageSection
            id="modifier-sets-list"
            title="Smart modifier sets"
            description="Category-wide groups apply to every item in that category (e.g. burger extras). Item-specific groups force conversational prompts on POS — cook temp, two sides, etc."
            defaultOpen
            headerActions={newSetButton}
          >
            {listContent}
          </PageSection>
        </PageSectionShell>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New modifier set" size="lg">
        <div className="space-y-4">
          <FormField label="Prompt label (shown to servers)">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Burger extras"
            />
          </FormField>
          <FormField label="Applies to">
            <Select
              value={form.scope}
              onChange={(e) =>
                setForm((f) => ({ ...f, scope: e.target.value as "category" | "item" }))
              }
            >
              <option value="category">Entire food category</option>
              <option value="item">Single menu item (forced conversational)</option>
            </Select>
          </FormField>
          {form.scope === "category" ? (
            <FormField label="Category">
              <Select
                value={form.categories}
                onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))}
              >
                {MENU_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Menu item">
              <Select
                value={form.menuItemId}
                onChange={(e) => setForm((f) => ({ ...f, menuItemId: e.target.value }))}
              >
                <option value="">Select item…</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.category})
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Forced on POS?">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
              />
              Server must answer before firing (cook temp, sides, etc.)
            </label>
          </FormField>
          {form.required && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Min selections">
                <Input
                  type="number"
                  min={1}
                  value={form.minSelect}
                  onChange={(e) => setForm((f) => ({ ...f, minSelect: e.target.value }))}
                />
              </FormField>
              <FormField label="Max selections">
                <Input
                  type="number"
                  min={1}
                  value={form.maxSelect}
                  onChange={(e) => setForm((f) => ({ ...f, maxSelect: e.target.value }))}
                />
              </FormField>
            </div>
          )}
          <FormField label="Options (one per line)">
            <Textarea
              rows={5}
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              placeholder={"Rare\nMedium Rare\nMedium"}
            />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving…" : "Create set"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

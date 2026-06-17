"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  Loader2,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Input, Select, FormField, Textarea, Modal } from "@/components/ui/form";
import { cn, formatCurrency } from "@/lib/utils";
import {
  LOG_BOOK_CATEGORIES,
  categoryColor,
  categoryLabel,
} from "@/lib/log-book/categories";
import { formatLogDate, toDateInputValue } from "@/lib/log-book/utils";

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

interface LogMention {
  id: string;
  staffMemberId: string | null;
  mentionLabel: string;
  staffMember: { id: string; name: string; role: string } | null;
}

interface LogEntry {
  id: string;
  logDate: string;
  authorName: string;
  category: string;
  title: string | null;
  content: string;
  salesTotal: number | null;
  guestCount: number | null;
  laborHours: number | null;
  laborCost: number | null;
  staffingNote: string | null;
  maintenanceNote: string | null;
  pinned: boolean;
  createdAt: string;
  mentions: LogMention[];
}

interface DaySnapshot {
  salesTotal: number;
  guestCount: number;
  laborHours: number;
  laborCost: number;
  scheduledShifts: number;
  orderCount: number;
}

const EMPTY_FORM = {
  logDate: toDateInputValue(new Date()),
  category: "GENERAL",
  title: "",
  content: "",
  staffingNote: "",
  maintenanceNote: "",
  salesTotal: "",
  guestCount: "",
  laborHours: "",
  laborCost: "",
  pinned: false,
  staffMemberIds: [] as string[],
};

export function LogBookClient({ staff }: { staff: StaffOption[] }) {
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [recentDays, setRecentDays] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DaySnapshot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMode = activeSearch.length > 0 || staffFilter.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchMode) {
        if (activeSearch) params.set("q", activeSearch);
        if (staffFilter) params.set("staffMemberId", staffFilter);
        if (categoryFilter) params.set("category", categoryFilter);
      } else {
        params.set("date", selectedDate);
      }
      const res = await fetch(`/api/log-book?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load log book");
      setEntries(json.entries);
      setRecentDays(json.recentDays ?? []);
      setCanManage(json.canManage ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeSearch, categoryFilter, searchMode, selectedDate, staffFilter]);

  const loadSnapshot = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/log-book/snapshot?date=${date}`);
      const json = await res.json();
      if (res.ok) setSnapshot(json);
    } catch {
      setSnapshot(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!searchMode) void loadSnapshot(selectedDate);
  }, [loadSnapshot, searchMode, selectedDate]);

  const runSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setStaffFilter("");
    setCategoryFilter("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, logDate: selectedDate });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (entry: LogEntry) => {
    setEditing(entry);
    setForm({
      logDate: toDateInputValue(new Date(entry.logDate)),
      category: entry.category,
      title: entry.title ?? "",
      content: entry.content,
      staffingNote: entry.staffingNote ?? "",
      maintenanceNote: entry.maintenanceNote ?? "",
      salesTotal: entry.salesTotal != null ? String(entry.salesTotal) : "",
      guestCount: entry.guestCount != null ? String(entry.guestCount) : "",
      laborHours: entry.laborHours != null ? String(entry.laborHours) : "",
      laborCost: entry.laborCost != null ? String(entry.laborCost) : "",
      pinned: entry.pinned,
      staffMemberIds: entry.mentions
        .map((m) => m.staffMemberId)
        .filter((id): id is string => Boolean(id)),
    });
    setError(null);
    setModalOpen(true);
  };

  const pullSnapshot = async () => {
    const res = await fetch(`/api/log-book/snapshot?date=${form.logDate}`);
    const json = await res.json();
    if (!res.ok) return;
    setForm((f) => ({
      ...f,
      salesTotal: String(json.salesTotal ?? ""),
      guestCount: String(json.guestCount ?? ""),
      laborHours: String(json.laborHours ?? ""),
      laborCost: String(json.laborCost ?? ""),
    }));
  };

  const toggleStaffTag = (id: string) => {
    setForm((f) => ({
      ...f,
      staffMemberIds: f.staffMemberIds.includes(id)
        ? f.staffMemberIds.filter((x) => x !== id)
        : [...f.staffMemberIds, id],
    }));
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      setError("Write what happened — the log entry cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        logDate: form.logDate,
        category: form.category,
        title: form.title || null,
        content: form.content.trim(),
        staffingNote: form.staffingNote || null,
        maintenanceNote: form.maintenanceNote || null,
        salesTotal: form.salesTotal ? parseFloat(form.salesTotal) : null,
        guestCount: form.guestCount ? parseInt(form.guestCount, 10) : null,
        laborHours: form.laborHours ? parseFloat(form.laborHours) : null,
        laborCost: form.laborCost ? parseFloat(form.laborCost) : null,
        pinned: form.pinned,
        staffMemberIds: form.staffMemberIds,
      };
      const url = editing ? `/api/log-book/${editing.id}` : "/api/log-book";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setModalOpen(false);
      await load();
      if (!searchMode) await loadSnapshot(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this log entry?")) return;
    await fetch(`/api/log-book/${id}`, { method: "DELETE" });
    await load();
  };

  const headerTitle = useMemo(() => {
    if (searchMode) {
      if (staffFilter) {
        const name = staff.find((s) => s.id === staffFilter)?.name ?? "Employee";
        return `Search: ${name}`;
      }
      return activeSearch ? `Search: “${activeSearch}”` : "Search results";
    }
    return formatLogDate(selectedDate);
  }, [activeSearch, searchMode, selectedDate, staff, staffFilter]);

  return (
    <>
      {/* Search */}
      <div className="no-print mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search logs — employee name, issue, keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <Select
            className="w-auto min-w-[140px]"
            value={staffFilter}
            onChange={(e) => {
              setStaffFilter(e.target.value);
              if (e.target.value) setActiveSearch(searchQuery);
            }}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto min-w-[130px]"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {LOG_BOOK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={runSearch}>
            Search
          </Button>
          {searchMode && (
            <Button variant="ghost" onClick={clearSearch}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Search across every log entry — find all documentation mentioning an employee, a maintenance
          issue, or any keyword.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Day picker */}
        {!searchMode && (
          <aside className="no-print space-y-3">
            <FormField label="Business date">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </FormField>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent days
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {recentDays.length === 0 && (
                  <li className="text-slate-400">No entries yet</li>
                )}
                {recentDays.map((iso) => {
                  const val = toDateInputValue(new Date(iso));
                  return (
                    <li key={iso}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50",
                          val === selectedDate && "bg-orange-50 font-medium text-orange-700"
                        )}
                        onClick={() => setSelectedDate(val)}
                      >
                        {new Date(iso).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <BookOpen className="h-5 w-5 text-orange-500" />
                {headerTitle}
              </h2>
              {!searchMode && snapshot && (
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>Sales {formatCurrency(snapshot.salesTotal)}</span>
                  <span>{snapshot.guestCount} covers</span>
                  <span>{snapshot.laborHours}h labor</span>
                  <span>{snapshot.scheduledShifts} shifts scheduled</span>
                </div>
              )}
            </div>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New entry
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-12 w-12" />}
              title={searchMode ? "No matching entries" : "No log entries for this day"}
              description={
                searchMode
                  ? "Try a different name or keyword."
                  : "Management writes the daily journal here — sales, staffing, maintenance, and staff notes."
              }
              action={canManage && !searchMode ? <Button onClick={openCreate}>Write first entry</Button> : undefined}
            />
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className={cn(
                    "rounded-xl border bg-white p-5 shadow-sm",
                    entry.pinned && "border-orange-200 ring-1 ring-orange-100"
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={categoryColor(entry.category as never)}>
                        {categoryLabel(entry.category as never)}
                      </Badge>
                      {entry.pinned && (
                        <Badge className="bg-orange-100 text-orange-800">
                          <Pin className="mr-1 h-3 w-3" />
                          Pinned
                        </Badge>
                      )}
                      {entry.title && (
                        <span className="font-semibold text-slate-900">{entry.title}</span>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{entry.authorName}</p>
                      <p>
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {entry.content}
                  </p>

                  {(entry.salesTotal != null ||
                    entry.guestCount != null ||
                    entry.laborHours != null ||
                    entry.staffingNote ||
                    entry.maintenanceNote) && (
                    <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2">
                      {entry.salesTotal != null && (
                        <p>Sales: {formatCurrency(entry.salesTotal)}</p>
                      )}
                      {entry.guestCount != null && <p>Covers: {entry.guestCount}</p>}
                      {entry.laborHours != null && <p>Labor: {entry.laborHours}h</p>}
                      {entry.laborCost != null && (
                        <p>Labor cost: {formatCurrency(entry.laborCost)}</p>
                      )}
                      {entry.staffingNote && <p>Staffing: {entry.staffingNote}</p>}
                      {entry.maintenanceNote && <p>Maintenance: {entry.maintenanceNote}</p>}
                    </div>
                  )}

                  {entry.mentions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.mentions.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                          onClick={() => {
                            setStaffFilter(m.staffMemberId ?? "");
                            setSearchQuery(m.mentionLabel);
                            setActiveSearch(m.mentionLabel);
                          }}
                        >
                          <User className="h-3 w-3" />
                          {m.mentionLabel}
                        </button>
                      ))}
                    </div>
                  )}

                  {canManage && (
                    <div className="mt-4 flex gap-2 no-print">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit log entry" : "New log entry"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Business date">
              <Input
                type="date"
                value={form.logDate}
                onChange={(e) => setForm({ ...form, logDate: e.target.value })}
              />
            </FormField>
            <FormField label="Category">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {LOG_BOOK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Title (optional)">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Friday dinner rush"
            />
          </FormField>

          <FormField label="Journal entry">
            <Textarea
              rows={6}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="What happened today? Sales pacing, call-outs, guest issues, equipment problems…"
            />
          </FormField>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Tag staff mentioned</p>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    form.staffMemberIds.includes(s.id)
                      ? "border-violet-400 bg-violet-100 text-violet-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                  onClick={() => toggleStaffTag(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Day metrics (optional)</p>
              <Button type="button" size="sm" variant="ghost" onClick={pullSnapshot}>
                <Sparkles className="h-3 w-3" />
                Pull from POS
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sales total">
                <Input
                  type="number"
                  step="0.01"
                  value={form.salesTotal}
                  onChange={(e) => setForm({ ...form, salesTotal: e.target.value })}
                />
              </FormField>
              <FormField label="Guest count">
                <Input
                  type="number"
                  value={form.guestCount}
                  onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                />
              </FormField>
              <FormField label="Labor hours">
                <Input
                  type="number"
                  step="0.1"
                  value={form.laborHours}
                  onChange={(e) => setForm({ ...form, laborHours: e.target.value })}
                />
              </FormField>
              <FormField label="Labor cost">
                <Input
                  type="number"
                  step="0.01"
                  value={form.laborCost}
                  onChange={(e) => setForm({ ...form, laborCost: e.target.value })}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Staffing notes">
            <Input
              value={form.staffingNote}
              onChange={(e) => setForm({ ...form, staffingNote: e.target.value })}
              placeholder="Coverage gaps, call-outs, overtime…"
            />
          </FormField>
          <FormField label="Maintenance notes">
            <Input
              value={form.maintenanceNote}
              onChange={(e) => setForm({ ...form, maintenanceNote: e.target.value })}
              placeholder="Walk-in down, fryer repair scheduled…"
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Pin this entry to the top of the day
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

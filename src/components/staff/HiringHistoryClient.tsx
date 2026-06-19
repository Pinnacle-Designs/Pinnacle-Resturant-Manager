"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Star, UserMinus, UserX } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { FormField, Select, Textarea } from "@/components/ui/form";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { cn } from "@/lib/utils";

type RehireStatus = "UNKNOWN" | "YES" | "NO" | "MAYBE";
type HistorySort = "rating" | "name" | "date";

interface HistoryRecord {
  id: string;
  kind: "APPLICANT" | "FORMER_EMPLOYEE";
  applicantId: string | null;
  staffMemberId: string | null;
  applicationId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  outcome: string;
  outcomeDate: string;
  applicationNotes: string | null;
  terminationReason: string | null;
  rating: number | null;
  rehirable: RehireStatus;
  talentNotes: string | null;
}

const REHIRE_LABELS: Record<RehireStatus, string> = {
  UNKNOWN: "Not set",
  YES: "Rehirable",
  NO: "Do not rehire",
  MAYBE: "Maybe",
};

const REHIRE_COLORS: Record<RehireStatus, string> = {
  UNKNOWN: "bg-slate-100 text-slate-600",
  YES: "bg-emerald-100 text-emerald-800",
  NO: "bg-red-100 text-red-800",
  MAYBE: "bg-amber-100 text-amber-800",
};

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 transition-colors disabled:opacity-50"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-5 w-5",
              (value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function HistoryCard({
  record,
  rank,
  saving,
  onSave,
}: {
  record: HistoryRecord;
  rank: number;
  saving: boolean;
  onSave: (patch: Partial<Pick<HistoryRecord, "rating" | "rehirable" | "talentNotes">>) => void;
}) {
  const [rating, setRating] = useState(record.rating);
  const [rehirable, setRehirable] = useState(record.rehirable);
  const [notes, setNotes] = useState(record.talentNotes ?? "");

  useEffect(() => {
    setRating(record.rating);
    setRehirable(record.rehirable);
    setNotes(record.talentNotes ?? "");
  }, [record]);

  const dirty =
    rating !== record.rating ||
    rehirable !== record.rehirable ||
    notes !== (record.talentNotes ?? "");

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              #{rank}
            </span>
            <h3 className="truncate font-semibold text-slate-900">{record.name}</h3>
            <Badge
              className={
                record.kind === "FORMER_EMPLOYEE"
                  ? "bg-violet-100 text-violet-800"
                  : "bg-slate-100 text-slate-700"
              }
            >
              {record.kind === "FORMER_EMPLOYEE" ? "Former employee" : "Past applicant"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {record.role} · {record.outcome}
          </p>
          <p className="text-xs text-slate-400">
            {format(new Date(record.outcomeDate), "MMM d, yyyy")}
            {record.phone ? ` · ${record.phone}` : ""}
          </p>
        </div>
        <Badge className={REHIRE_COLORS[rehirable]}>{REHIRE_LABELS[rehirable]}</Badge>
      </div>

      {(record.applicationNotes || record.terminationReason) && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {record.terminationReason && (
            <p>
              <span className="font-medium text-slate-700">Separation:</span> {record.terminationReason}
            </p>
          )}
          {record.applicationNotes && (
            <p className={record.terminationReason ? "mt-1" : ""}>
              <span className="font-medium text-slate-700">Application notes:</span>{" "}
              {record.applicationNotes}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Performance rank (1–5 stars)">
          <StarRating value={rating} onChange={setRating} disabled={saving} />
        </FormField>
        <FormField label="Rehire status">
          <Select
            value={rehirable}
            onChange={(e) => setRehirable(e.target.value as RehireStatus)}
            disabled={saving}
          >
            <option value="UNKNOWN">Not set</option>
            <option value="YES">Rehirable — welcome back</option>
            <option value="MAYBE">Maybe — case by case</option>
            <option value="NO">Do not rehire</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Manager notes" className="mt-4">
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interview impressions, reliability, skills, incidents…"
          disabled={saving}
        />
      </FormField>

      {dirty && (
        <Button
          size="sm"
          className="mt-3"
          disabled={saving}
          onClick={() => onSave({ rating, rehirable, talentNotes: notes || null })}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      )}
    </article>
  );
}

export function HiringHistoryClient() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [sort, setSort] = useState<HistorySort>("rating");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "APPLICANT" | "FORMER_EMPLOYEE">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hiring/history?sort=${sort}`);
      const data = await res.json();
      if (res.ok) setRecords(data.records || []);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRecord = async (
    record: HistoryRecord,
    patch: Partial<Pick<HistoryRecord, "rating" | "rehirable" | "talentNotes">>
  ) => {
    setSavingId(record.id);
    try {
      const res = await fetch("/api/hiring/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: record.kind,
          applicantId: record.applicantId,
          staffMemberId: record.staffMemberId,
          ...patch,
        }),
      });
      if (res.ok) await load();
    } finally {
      setSavingId(null);
    }
  };

  const visible = records.filter((r) => filter === "all" || r.kind === filter);

  return (
    <PageSectionShell pageId="hiring-history">
      <PageSection id="hiring-history-list" title="Hiring history" defaultOpen>
        <p className="mb-4 text-sm text-slate-600">
          Past applicants and former employees — ranked by star rating. Track who you&apos;d welcome
          back and keep notes for future hiring decisions.
        </p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FormField label="Sort by" className="sm:w-40">
            <Select value={sort} onChange={(e) => setSort(e.target.value as HistorySort)}>
              <option value="rating">Highest rated</option>
              <option value="date">Most recent</option>
              <option value="name">Name A–Z</option>
            </Select>
          </FormField>
          <FormField label="Show" className="sm:w-48">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">Everyone in history</option>
              <option value="APPLICANT">Past applicants only</option>
              <option value="FORMER_EMPLOYEE">Former employees only</option>
            </Select>
          </FormField>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">Loading hiring history…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<UserX className="h-12 w-12" />}
            title="No history yet"
            description="Reject or withdraw applicants from the pipeline, or deactivate team members — they'll appear here for ranking and rehire notes."
          />
        ) : (
          <div className="space-y-4">
            {visible.map((record, index) => (
              <HistoryCard
                key={record.id}
                record={record}
                rank={index + 1}
                saving={savingId === record.id}
                onSave={(patch) => void saveRecord(record, patch)}
              />
            ))}
          </div>
        )}
      </PageSection>
    </PageSectionShell>
  );
}

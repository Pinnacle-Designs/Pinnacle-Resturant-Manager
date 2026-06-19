"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  MessageSquare,
  Phone,
  UserPlus,
  UserMinus,
  Calendar,
  CheckCircle2,
  Send,
  Smartphone,
} from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { Input, Select, FormField, Modal } from "@/components/ui/form";
import { OnboardingLinkPanel } from "@/components/hiring/OnboardingLinkPanel";
import { HiringHistoryClient } from "@/components/staff/HiringHistoryClient";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";
import { ScrollableTabs, TabPill } from "@/components/ui";
import { cn } from "@/lib/utils";

const PIPELINE: { status: string; label: string; color: string }[] = [
  { status: "NEW", label: "New", color: "bg-blue-100 text-blue-800" },
  { status: "SCREENING", label: "Screening", color: "bg-slate-100 text-slate-800" },
  { status: "INTERVIEW_SCHEDULED", label: "Interview", color: "bg-purple-100 text-purple-800" },
  { status: "OFFERED", label: "Offered", color: "bg-amber-100 text-amber-800" },
  { status: "HIRED", label: "Hired", color: "bg-green-100 text-green-800" },
];

interface Application {
  id: string;
  role: string;
  status: string;
  source: string;
  appliedAt: string;
  applicant: { id: string; name: string; phone: string; email: string | null };
  interviews: { scheduledAt: string }[];
  onboardingPacket: {
    token: string;
    status: string;
    documents?: { docType: string; completedAt: string | null }[];
    acknowledgments?: { policyKey: string }[];
  } | null;
}

interface SmsMessage {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
}

export function HiringClient() {
  const [hiringView, setHiringView] = useState<"pipeline" | "history">("pipeline");
  const [applications, setApplications] = useState<Application[]>([]);
  const [settings, setSettings] = useState<{
    applyPhone: string | null;
    applyKeyword: string;
    smsEnabled: boolean;
  } | null>(null);
  const [postings, setPostings] = useState<{ applyCode: string; title: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [smsText, setSmsText] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [sending, setSending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newApplicant, setNewApplicant] = useState({ name: "", phone: "", role: "Server" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, settingsRes] = await Promise.all([
        fetch("/api/hiring/applications"),
        fetch("/api/hiring/settings"),
      ]);
      const appsData = await appsRes.json();
      const settingsData = await settingsRes.json();
      setApplications(appsData.applications || []);
      setSettings(settingsData.settings);
      setPostings(settingsData.postings || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mergeApplication = (base: Application, fresh: Partial<Application>): Application => ({
    ...base,
    ...fresh,
    applicant: fresh.applicant ?? base.applicant,
    interviews: fresh.interviews ?? base.interviews,
    onboardingPacket: fresh.onboardingPacket ?? base.onboardingPacket,
  });

  const openApplicant = async (app: Application) => {
    setSelected(app);
    setInterviewAt("");
    setSmsText("");
    const res = await fetch(`/api/hiring/applications/${app.id}`);
    const data = await res.json();
    if (data.application) {
      setSelected(mergeApplication(app, data.application));
    }
    setMessages(data.messages || []);
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch(`/api/hiring/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = await res.json();
      if (res.ok && updated?.id) {
        setSelected(mergeApplication(selected, updated));
        if (status === "REJECTED" || status === "WITHDRAWN") {
          setSelected(null);
        }
      }
      await load();
    } finally {
      setSending(false);
    }
  };

  const resendOnboarding = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch(`/api/hiring/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendOnboarding: true }),
      });
      const updated = await res.json();
      if (res.ok && updated?.id) {
        setSelected(mergeApplication(selected, updated));
      }
    } finally {
      setSending(false);
    }
  };

  const scheduleInterview = async () => {
    if (!selected || !interviewAt) return;
    setSending(true);
    try {
      await fetch(`/api/hiring/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleInterview: true,
          scheduledAt: new Date(interviewAt).toISOString(),
        }),
      });
      await openApplicant(selected);
      await load();
    } finally {
      setSending(false);
    }
  };

  const sendSms = async () => {
    if (!selected || !smsText.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/hiring/applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsBody: smsText.trim() }),
      });
      setSmsText("");
      await openApplicant(selected);
    } finally {
      setSending(false);
    }
  };

  const addWalkIn = async () => {
    setSending(true);
    try {
      await fetch("/api/hiring/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApplicant),
      });
      setAddOpen(false);
      setNewApplicant({ name: "", phone: "", role: "Server" });
      await load();
    } finally {
      setSending(false);
    }
  };

  const byStatus = (status: string) =>
    applications.filter((a) => a.status === status && !["REJECTED", "WITHDRAWN"].includes(a.status));

  if (loading) {
    return <p className="text-center text-slate-500 py-8">Loading applicants…</p>;
  }

  return (
    <>
      <ScrollableTabs className="mb-4 border-b border-slate-200 pb-2" menuLabel="Hiring">
        <TabPill active={hiringView === "pipeline"} onClick={() => setHiringView("pipeline")}>
          Active pipeline
        </TabPill>
        <TabPill active={hiringView === "history"} onClick={() => setHiringView("history")}>
          Hiring history
        </TabPill>
      </ScrollableTabs>

      {hiringView === "history" ? (
        <HiringHistoryClient />
      ) : (
      <PageSectionShell pageId="hiring">
        <PageSection id="hiring-onboarding" title="Mobile onboarding" defaultOpen>
          <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Smartphone className="h-4 w-4 text-green-600" />
              Paperless mobile onboarding
            </p>
            <p className="mt-1 text-sm text-slate-600">
              When you click <strong>Hire &amp; send onboarding</strong>, new hires get a phone-friendly link to
              complete <strong>I-9</strong>, <strong>W-4</strong>, <strong>direct deposit</strong>, and handbook
              acknowledgments before their first shift. Open any hired applicant to copy the link or preview the flow.
            </p>
          </div>
        </PageSection>

        <PageSection
          id="hiring-text-to-apply"
          title="Text-to-apply"
          headerActions={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Add walk-in
            </Button>
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mt-1 text-sm text-slate-600">
                {settings?.applyPhone ? (
                  <>
                    Text <strong>{settings.applyKeyword}</strong> to{" "}
                    <strong>{settings.applyPhone}</strong>
                    {postings[0] && (
                      <>
                        {" "}
                        or <strong>{settings.applyKeyword} {postings[0].applyCode}</strong> for a role
                      </>
                    )}
                  </>
                ) : (
                  <>Configure apply phone in settings — SMS works in dev (simulated in console)</>
                )}
              </p>
              {postings.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Web apply: /apply?code={postings[0].applyCode}
                </p>
              )}
            </div>
          </div>
        </PageSection>

        <PageSection id="hiring-pipeline" title="Applicant pipeline" defaultOpen>
          {applications.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-12 w-12" />}
              title="No applicants yet"
              description="Share your text-to-apply number or post a job code to start hiring."
            />
          ) : (
            <div className="grid gap-3 overflow-x-auto lg:grid-cols-5">
              {PIPELINE.map((col) => (
                <div key={col.status} className="min-w-[200px] rounded-xl border bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {col.label} ({byStatus(col.status).length})
                  </p>
                  <ul className="space-y-2">
                    {byStatus(col.status).map((app) => (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => openApplicant(app)}
                          className="w-full rounded-lg border bg-white p-3 text-left text-sm hover:border-orange-300"
                        >
                          <p className="font-medium text-slate-900">{app.applicant.name}</p>
                          <p className="text-xs text-slate-500">{app.role}</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {app.source.replace("_", " ")} · {format(new Date(app.appliedAt), "MMM d")}
                          </p>
                          {app.status === "HIRED" && app.onboardingPacket && (
                            <p className="mt-1 text-[10px] font-medium text-green-700">
                              Onboarding · {app.onboardingPacket.status === "COMPLETE" ? "done" : "in progress"}
                            </p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </PageSection>
      </PageSectionShell>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.applicant.name || "Applicant"}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {selected.applicant.phone}
              </span>
              <span>{selected.role}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PIPELINE.find((p) => p.status === selected.status)?.color)}>
                {selected.status.replace("_", " ")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {PIPELINE.filter((p) => p.status !== selected.status).map((p) => (
                <Button key={p.status} size="sm" variant="secondary" disabled={sending} onClick={() => updateStatus(p.status)}>
                  Move to {p.label}
                </Button>
              ))}
              <Button size="sm" disabled={sending} onClick={() => updateStatus("HIRED")}>
                <CheckCircle2 className="h-4 w-4" />
                Hire & send onboarding
              </Button>
              <Button size="sm" variant="secondary" disabled={sending} onClick={() => updateStatus("REJECTED")}>
                <UserMinus className="h-4 w-4" />
                Reject
              </Button>
              <Button size="sm" variant="ghost" disabled={sending} onClick={() => updateStatus("WITHDRAWN")}>
                Mark withdrawn
              </Button>
            </div>

            {selected.onboardingPacket && (
              <OnboardingLinkPanel
                packet={{
                  token: selected.onboardingPacket.token,
                  status: selected.onboardingPacket.status,
                  documents: selected.onboardingPacket.documents ?? [],
                  acknowledgments: selected.onboardingPacket.acknowledgments ?? [],
                }}
                applicantName={selected.applicant.name}
                onResend={resendOnboarding}
                resending={sending}
              />
            )}

            {selected.status === "HIRED" && !selected.onboardingPacket && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Onboarding link is being created… If this persists, click Hire &amp; send onboarding again.
              </p>
            )}

            <FormField label="Schedule interview (sends SMS reminder)">
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={interviewAt}
                  onChange={(e) => setInterviewAt(e.target.value)}
                  className="flex-1"
                />
                <Button disabled={sending || !interviewAt} onClick={scheduleInterview}>
                  <Calendar className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </FormField>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <MessageSquare className="h-4 w-4" />
                SMS thread
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-slate-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-400">No messages yet</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        m.direction === "OUTBOUND"
                          ? "ml-auto bg-orange-100 text-orange-900"
                          : "bg-white text-slate-800"
                      )}
                    >
                      {m.body}
                      <p className="mt-0.5 text-[10px] opacity-60">
                        {format(new Date(m.createdAt), "MMM d h:mm a")}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder="Text applicant…"
                  className="flex-1"
                />
                <Button disabled={sending || !smsText.trim()} onClick={sendSms}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add walk-in applicant">
        <div className="space-y-4">
          <FormField label="Name">
            <Input value={newApplicant.name} onChange={(e) => setNewApplicant({ ...newApplicant, name: e.target.value })} />
          </FormField>
          <FormField label="Phone">
            <Input value={newApplicant.phone} onChange={(e) => setNewApplicant({ ...newApplicant, phone: e.target.value })} />
          </FormField>
          <FormField label="Role">
            <Select value={newApplicant.role} onChange={(e) => setNewApplicant({ ...newApplicant, role: e.target.value })}>
              <option>Server</option>
              <option>Bartender</option>
              <option>Host</option>
              <option>Line Cook</option>
              <option>Prep Cook</option>
              <option>Dishwasher</option>
              <option>Manager</option>
            </Select>
          </FormField>
          <Button className="w-full" disabled={sending} onClick={addWalkIn}>
            Add to pipeline
          </Button>
        </div>
      </Modal>
    </>
  );
}

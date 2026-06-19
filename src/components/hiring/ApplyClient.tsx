"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/ui/form";
import { Logo } from "@/components/layout/Logo";
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";

export function ApplyClient({ applyCode }: { applyCode?: string }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: "Server" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hiring/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, applyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 py-8">
      <Logo className="mb-8 h-12" />
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        {done ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">Application sent!</h1>
            <p className="mt-2 text-slate-600">
              Check your phone — we&apos;ll text you about interview scheduling.
            </p>
          </div>
        ) : (
          <PageSectionShell pageId="apply">
            <PageSection
              id="apply-form"
              title="Apply now"
              description="Prefer text? Reply APPLY to our hiring number."
              defaultOpen
            >
              <form className="space-y-4" onSubmit={submit}>
                <FormField label="Full name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Mobile phone">
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Email (optional)">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </FormField>
                {!applyCode && (
                  <FormField label="Role interested in">
                    <Input
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                  </FormField>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  <Send className="h-4 w-4" />
                  {loading ? "Submitting…" : "Submit application"}
                </Button>
              </form>
            </PageSection>
          </PageSectionShell>
        )}
      </div>
    </div>
  );
}

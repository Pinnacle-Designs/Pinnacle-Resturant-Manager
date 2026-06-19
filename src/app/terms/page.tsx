import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Pinnacle Restaurant Manager",
  description: "Terms governing use of Pinnacle Restaurant Manager.",
};

export default function TermsPage() {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || "support@pinnacle.app";
  const updated = "June 18, 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-slate-500">Last updated {updated}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        By creating an account or using Pinnacle Restaurant Manager, you agree to these terms on behalf of
        yourself and your business.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Service</h2>
        <p className="text-slate-600 leading-relaxed">
          Pinnacle provides cloud software for restaurant operations, analytics, and optional AI features.
          Features vary by subscription plan. We may update the product over time.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Accounts &amp; access</h2>
        <p className="text-slate-600 leading-relaxed">
          You are responsible for credentials and for activity under your account. Assign roles and
          permissions appropriately for your team. You must provide accurate business information.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Billing</h2>
        <p className="text-slate-600 leading-relaxed">
          Paid plans are billed per location per month unless otherwise agreed in writing. Subscriptions
          renew automatically via Stripe until canceled. Fees are non-refundable except where required by
          law. Guest card payments at the table are processed by your connected Square or Stripe Connect
          account under their terms.
        </p>
        <p className="text-slate-600 leading-relaxed">
          Plan-specific subscription agreements (month-to-month, cancel anytime):
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-600">
          <li>
            <Link href="/terms/subscription/starter" className="font-medium text-orange-600 hover:text-orange-500">
              Starter — $79/mo
            </Link>
          </li>
          <li>
            <Link href="/terms/subscription/growth" className="font-medium text-orange-600 hover:text-orange-500">
              Growth — $249/mo
            </Link>
          </li>
          <li>
            <Link href="/terms/subscription/pro" className="font-medium text-orange-600 hover:text-orange-500">
              Pro — $449/mo
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Acceptable use</h2>
        <p className="text-slate-600 leading-relaxed">
          Do not misuse the service, attempt unauthorized access, interfere with other customers, or upload
          unlawful content. You retain ownership of your operational data; you grant us a license to host
          and process it to provide the service.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Disclaimer</h2>
        <p className="text-slate-600 leading-relaxed">
          Pinnacle is provided &quot;as is.&quot; AI insights, forecasts, and OCR output are aids for decision
          making — not legal, tax, or financial advice. You remain responsible for compliance with labor,
          food safety, and tax regulations.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Limitation of liability</h2>
        <p className="text-slate-600 leading-relaxed">
          To the maximum extent permitted by law, our liability is limited to fees paid in the twelve months
          before the claim. We are not liable for indirect or consequential damages.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p className="text-slate-600 leading-relaxed">
          Questions about these terms:{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-orange-600 hover:text-orange-500">
            {supportEmail}
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-slate-500">
        <Link href="/privacy" className="text-orange-600 hover:text-orange-500">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/" className="text-orange-600 hover:text-orange-500">
          Home
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Pinnacle Restaurant Manager",
  description: "How Pinnacle Restaurant Manager collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || "support@pinnacle.app";
  const updated = "June 18, 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-slate-500">Last updated {updated}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        Pinnacle Restaurant Manager (&quot;Pinnacle,&quot; &quot;we,&quot; &quot;us&quot;) provides restaurant
        operations software. This policy describes how we handle information when you use our website and
        application.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-600">
          <li>
            <strong>Account data</strong> — name, email, restaurant details, and role assignments you provide
            at signup.
          </li>
          <li>
            <strong>Operational data</strong> — orders, menu items, inventory, staff schedules, expenses,
            photos, and analytics generated while you use the product.
          </li>
          <li>
            <strong>Payment metadata</strong> — subscription status and billing identifiers from Stripe. We do
            not store full card numbers on our servers.
          </li>
          <li>
            <strong>Technical data</strong> — IP address, browser type, and cookies used for authentication
            and security.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">How we use information</h2>
        <p className="text-slate-600 leading-relaxed">
          We use your data to operate the service, process subscriptions, provide AI-assisted features you
          enable, improve reliability, and respond to support requests. We do not sell your personal
          information.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Third-party processors</h2>
        <p className="text-slate-600 leading-relaxed">
          We use trusted providers such as Stripe (billing), hosting infrastructure, and optional integrations
          you connect (e.g. Square, payroll, accounting). Their use of data is governed by their own policies.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Retention &amp; security</h2>
        <p className="text-slate-600 leading-relaxed">
          We retain data while your account is active and as needed for legal, billing, or backup purposes.
          Sessions are signed and HTTP-only; production deployments require a strong{" "}
          <code className="rounded bg-slate-100 px-1 text-sm">AUTH_SECRET</code>. Access is scoped by role,
          plan, and location.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Your choices</h2>
        <p className="text-slate-600 leading-relaxed">
          You may update profile information in Account settings, export operational data via reports where
          available, and request account deletion by contacting us. Cancel subscription autopay anytime in
          Account → Billing.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p className="text-slate-600 leading-relaxed">
          Questions about this policy:{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-orange-600 hover:text-orange-500">
            {supportEmail}
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-slate-500">
        <Link href="/terms" className="text-orange-600 hover:text-orange-500">
          Terms of Service
        </Link>
        {" · "}
        <Link href="/" className="text-orange-600 hover:text-orange-500">
          Home
        </Link>
      </p>
    </div>
  );
}

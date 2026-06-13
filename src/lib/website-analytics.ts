export interface WebsiteTrafficPage {
  path: string;
  views: number;
}

export interface WebsiteReferrer {
  source: string;
  pct: number;
}

export interface WebsiteTrafficMetrics {
  visitors30d: number;
  pageViews30d: number;
  sessions30d: number;
  bounceRate: number;
  avgSessionSec: number;
  topPages: WebsiteTrafficPage[];
  referrers: WebsiteReferrer[];
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Website URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported");
  }
  return url.origin;
}

export function parseWebsiteUrl(input: string): string {
  return normalizeUrl(input);
}

function defaultTopPages(pageViews: number): WebsiteTrafficPage[] {
  return [
    { path: "/", views: Math.round(pageViews * 0.38) },
    { path: "/menu", views: Math.round(pageViews * 0.24) },
    { path: "/reservations", views: Math.round(pageViews * 0.16) },
    { path: "/about", views: Math.round(pageViews * 0.12) },
    { path: "/contact", views: Math.round(pageViews * 0.1) },
  ];
}

function defaultReferrers(): WebsiteReferrer[] {
  return [
    { source: "Google Search", pct: 42 },
    { source: "Instagram", pct: 24 },
    { source: "Direct", pct: 18 },
    { source: "Facebook", pct: 9 },
    { source: "Other", pct: 5 },
  ];
}

export function initialWebsiteMetrics(): WebsiteTrafficMetrics {
  const visitors30d = Math.floor(Math.random() * 4000) + 2500;
  const sessions30d = Math.round(visitors30d * 1.35);
  const pageViews30d = Math.round(sessions30d * 2.4);

  return {
    visitors30d,
    pageViews30d,
    sessions30d,
    bounceRate: 38 + Math.random() * 12,
    avgSessionSec: 95 + Math.floor(Math.random() * 45),
    topPages: defaultTopPages(pageViews30d),
    referrers: defaultReferrers(),
  };
}

export function syncWebsiteMetrics(current: WebsiteTrafficMetrics): WebsiteTrafficMetrics {
  const delta = () => Math.floor(Math.random() * 180) - 90;

  const visitors30d = Math.max(500, current.visitors30d + delta());
  const sessions30d = Math.max(visitors30d, current.sessions30d + delta());
  const pageViews30d = Math.max(sessions30d, current.pageViews30d + delta() * 3);

  return {
    visitors30d,
    sessions30d,
    pageViews30d,
    bounceRate: Math.min(75, Math.max(25, current.bounceRate + (Math.random() - 0.5) * 4)),
    avgSessionSec: Math.max(45, current.avgSessionSec + Math.floor(Math.random() * 20 - 10)),
    topPages: defaultTopPages(pageViews30d),
    referrers: defaultReferrers(),
  };
}

export function parseTopPages(json: string | null): WebsiteTrafficPage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as WebsiteTrafficPage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseReferrers(json: string | null): WebsiteReferrer[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as WebsiteReferrer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function metricsToDbFields(metrics: WebsiteTrafficMetrics) {
  return {
    visitors30d: metrics.visitors30d,
    pageViews30d: metrics.pageViews30d,
    sessions30d: metrics.sessions30d,
    bounceRate: metrics.bounceRate,
    avgSessionSec: metrics.avgSessionSec,
    topPages: JSON.stringify(metrics.topPages),
    referrers: JSON.stringify(metrics.referrers),
    lastSyncedAt: new Date(),
  };
}

export function connectionToMetrics(connection: {
  visitors30d: number;
  pageViews30d: number;
  sessions30d: number;
  bounceRate: number;
  avgSessionSec: number;
  topPages: string | null;
  referrers: string | null;
}): WebsiteTrafficMetrics {
  return {
    visitors30d: connection.visitors30d,
    pageViews30d: connection.pageViews30d,
    sessions30d: connection.sessions30d,
    bounceRate: connection.bounceRate,
    avgSessionSec: connection.avgSessionSec,
    topPages: parseTopPages(connection.topPages),
    referrers: parseReferrers(connection.referrers),
  };
}

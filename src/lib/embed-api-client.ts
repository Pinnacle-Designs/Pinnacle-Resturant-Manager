import { EMBED_SESSION_PARAM } from "./embed-session-middleware";

/** Non-httpOnly cookie so embedded iframes can attach `_st` to API fetches (CHIPS / 3rd-party cookie limits). */
export const EMBED_API_COOKIE_NAME = "pinnacle_embed_st";

export function getEmbedSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${EMBED_API_COOKIE_NAME}=([^;]+)`)
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Append embed session token for API requests when httpOnly cookies are not sent. */
export function withEmbedSession(url: string): string {
  const token = getEmbedSessionToken();
  if (!token) return url;

  if (typeof window === "undefined") return url;

  const resolved = new URL(url, window.location.origin);
  if (!resolved.searchParams.has(EMBED_SESSION_PARAM)) {
    resolved.searchParams.set(EMBED_SESSION_PARAM, token);
  }
  return `${resolved.pathname}${resolved.search}`;
}

export function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string"
      ? withEmbedSession(input)
      : input instanceof URL
        ? withEmbedSession(input.toString())
        : input;

  return fetch(url, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}

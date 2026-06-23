import { isEmbeddableEmbedParam } from "./embed-config";
import { EMBED_API_COOKIE_NAME, EMBED_SESSION_PARAM } from "./embed-constants";

export { EMBED_API_COOKIE_NAME, EMBED_SESSION_PARAM } from "./embed-constants";

const STORAGE_KEY = "pinnacle_embed_st";

export function persistEmbedSessionToken(token: string | null | undefined): void {
  if (typeof window === "undefined" || !token?.trim()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    /* private mode / blocked storage */
  }
}

export function getEmbedSessionToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${EMBED_API_COOKIE_NAME}=([^;]+)`)
  );
  if (match?.[1]) {
    const token = decodeURIComponent(match[1]);
    persistEmbedSessionToken(token);
    return token;
  }

  const fromUrl = new URLSearchParams(window.location.search).get(EMBED_SESSION_PARAM);
  if (fromUrl) {
    persistEmbedSessionToken(fromUrl);
    return fromUrl;
  }

  return null;
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

/** Persist `_st` from the URL/cookie and patch fetch for iframe demos. */
export function bootstrapEmbedSession(embedParam: string | null): void {
  if (!isEmbeddableEmbedParam(embedParam)) return;
  const params = new URLSearchParams(window.location.search);
  const st = params.get(EMBED_SESSION_PARAM);
  if (st) persistEmbedSessionToken(st);
  else getEmbedSessionToken();
  installEmbedFetchPatch();
}

let fetchPatched = false;

/** Ensure every `/api/*` call in an embed carries credentials + `_st`. */
export function installEmbedFetchPatch(): void {
  if (typeof window === "undefined" || fetchPatched) return;
  const params = new URLSearchParams(window.location.search);
  if (!isEmbeddableEmbedParam(params.get("embed"))) return;

  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const credentials = init?.credentials ?? "include";

    if (typeof input === "string") {
      const url = input.startsWith("/api/") ? withEmbedSession(input) : input;
      return originalFetch(url, { ...init, credentials });
    }

    if (input instanceof URL) {
      const url = input.pathname.startsWith("/api/")
        ? withEmbedSession(input.toString())
        : input.toString();
      return originalFetch(url, { ...init, credentials });
    }

    if (input instanceof Request) {
      try {
        const parsed = new URL(input.url);
        if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/")) {
          const patched = withEmbedSession(`${parsed.pathname}${parsed.search}`);
          return originalFetch(new Request(patched, input), { ...init, credentials });
        }
      } catch {
        /* ignore malformed URLs */
      }
    }

    return originalFetch(input, { ...init, credentials });
  };
}

export function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  installEmbedFetchPatch();

  if (typeof input === "string") {
    return fetch(withEmbedSession(input), { ...init, credentials: init?.credentials ?? "include" });
  }
  if (input instanceof URL) {
    const url = input.pathname.startsWith("/api/") ? withEmbedSession(input.toString()) : input.toString();
    return fetch(url, { ...init, credentials: init?.credentials ?? "include" });
  }
  return fetch(input, { ...init, credentials: init?.credentials ?? "include" });
}

import { parseJsonResponse } from "@/lib/fetch-json";
import { clientFetch } from "@/lib/embed-api-client";

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await clientFetch(url, options);
  const data = await parseJsonResponse<{ error?: string } & T>(res);
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(url: string): Promise<void> {
  await apiFetch(url, { method: "DELETE" });
}

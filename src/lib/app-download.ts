export interface AppDownloadLinks {
  appStoreUrl: string | null;
  playStoreUrl: string | null;
}

export function getAppDownloadLinks(): AppDownloadLinks {
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || null;
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || null;
  return { appStoreUrl, playStoreUrl };
}

export function hasStoreListings(): boolean {
  const { appStoreUrl, playStoreUrl } = getAppDownloadLinks();
  return Boolean(appStoreUrl || playStoreUrl);
}

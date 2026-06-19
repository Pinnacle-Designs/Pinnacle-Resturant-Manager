"use client";

import { MonitorSmartphone, Share, Smartphone } from "lucide-react";

export function ManualInstallGuide({ isIOS, swReady }: { isIOS: boolean; swReady: boolean }) {
  if (isIOS) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Smartphone className="h-4 w-4 text-orange-500" />
          iPhone / iPad — Add to Home Screen
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Tap <Share className="inline h-3.5 w-3.5" /> Share in Safari
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong> to install Pinnacle
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <MonitorSmartphone className="h-4 w-4 text-orange-500" />
        Install on this device
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          Look for the <strong>Install</strong> icon in your browser&apos;s address bar (Chrome, Edge, or
          Brave)
        </li>
        <li>
          Or open the browser menu (⋮) and choose <strong>Install app</strong> or{" "}
          <strong>Install Pinnacle</strong>
        </li>
        <li>
          On Android, you can also tap <strong>Add to Home screen</strong>
        </li>
      </ol>
      {swReady && (
        <p className="mt-3 text-xs text-slate-500">
          If no install option appears yet, refresh this page once — the app is preparing for install.
        </p>
      )}
    </div>
  );
}

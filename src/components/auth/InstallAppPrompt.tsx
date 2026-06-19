"use client";

import { Download, MonitorSmartphone, Share, Smartphone, Store } from "lucide-react";
import { Button } from "@/components/ui";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { getAppDownloadLinks, hasStoreListings } from "@/lib/app-download";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

interface InstallAppPromptProps {
  plan?: PlanId;
  onContinue: () => void;
  embedded?: boolean;
}

function ManualInstallGuide({ isIOS, swReady }: { isIOS: boolean; swReady: boolean }) {
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

export function InstallAppPrompt({ plan, onContinue, embedded }: InstallAppPromptProps) {
  const {
    canNativeInstall,
    install,
    installing,
    isInstalled,
    isIOS,
    swReady,
    showManualInstallGuide,
  } = usePwaInstall();

  const { appStoreUrl, playStoreUrl } = getAppDownloadLinks();
  const storeListings = hasStoreListings();
  const planName = plan ? PLAN_BY_ID[plan].name : "your";

  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
        <Download className="h-7 w-7 text-orange-600" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Download Pinnacle on your device</h2>
      <p className="mt-2 text-sm text-slate-600">
        Your {planName} plan is ready. Install from the App Store or Google Play when available, or add
        Pinnacle to your home screen for quick access on phones and tablets.
      </p>

      {isInstalled ? (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Pinnacle is installed on this device. You&apos;re ready to go.
        </div>
      ) : (
        <div className="mt-6 space-y-4 text-left">
          {storeListings && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {appStoreUrl && (
                <a
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Store className="h-4 w-4" />
                  App Store
                </a>
              )}
              {playStoreUrl && (
                <a
                  href={playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Store className="h-4 w-4" />
                  Google Play
                </a>
              )}
            </div>
          )}

          {canNativeInstall && (
            <Button
              type="button"
              className="w-full"
              onClick={() => void install()}
              disabled={installing}
            >
              <Download className="h-4 w-4" />
              {installing ? "Installing…" : "Install app"}
            </Button>
          )}

          {showManualInstallGuide && <ManualInstallGuide isIOS={isIOS} swReady={swReady} />}
        </div>
      )}

      <div
        className={`mt-6 flex gap-2 ${embedded ? "flex-col-reverse sm:flex-row sm:justify-end" : "flex-col sm:flex-row sm:justify-center"}`}
      >
        {!isInstalled && (
          <Button type="button" variant="secondary" onClick={onContinue}>
            Continue in browser
          </Button>
        )}
        <Button type="button" onClick={onContinue}>
          {isInstalled ? "Open your workspace" : "Go to dashboard"}
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        By using Pinnacle you agree to our{" "}
        <a href="/terms" className="font-medium text-orange-600 hover:text-orange-500">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="font-medium text-orange-600 hover:text-orange-500">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

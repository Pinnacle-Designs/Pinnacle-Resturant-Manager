import { DownloadClient } from "@/components/download/DownloadClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Pinnacle — Install on your device",
  description: "Install Pinnacle Restaurant Manager on iPhone, iPad, Android, or desktop.",
};

export default function DownloadPage() {
  return <DownloadClient />;
}

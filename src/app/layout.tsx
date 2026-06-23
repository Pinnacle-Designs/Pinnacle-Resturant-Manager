import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pinnacle Restaurant Manager — AI-Powered Restaurant Operations",
  description:
    "All-in-one restaurant management with live demo — orders, inventory, staff, finances, 12-tab analytics, and an AI command center that answers profit, labor, and ops questions from live data.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pinnacle",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(location.search);var st=p.get("_st");var e=p.get("embed");if(st&&(e==="mobile"||e==="full"||e==="1")){window.__PINNACLE_EMBED_ST__=st;}}catch(x){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

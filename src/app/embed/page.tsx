import { Suspense } from "react";
import { EmbedBootstrap } from "./EmbedBootstrap";

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          Loading…
        </div>
      }
    >
      <EmbedBootstrap />
    </Suspense>
  );
}

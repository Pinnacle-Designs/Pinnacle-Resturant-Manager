import { redirect } from "next/navigation";

/** Walk-in counting now lives under Inventory → Zone count. */
export default function WalkInPage() {
  redirect("/inventory?tab=count");
}

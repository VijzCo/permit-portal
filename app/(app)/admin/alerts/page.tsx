import type { Metadata } from "next";
import { TestDigest } from "@/components/admin/test-digest";

export const metadata: Metadata = { title: "Alerts" };

export default function Page() {
  return <TestDigest />;
}

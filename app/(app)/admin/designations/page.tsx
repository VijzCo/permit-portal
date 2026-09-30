import type { Metadata } from "next";
import { DesignationsAdmin } from "@/components/admin/designations-admin";

export const metadata: Metadata = { title: "Designations" };

export default function Page() {
  return <DesignationsAdmin />;
}

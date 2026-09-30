import type { Metadata } from "next";
import { CompaniesAdmin } from "@/components/admin/companies-admin";

export const metadata: Metadata = { title: "Companies" };

export default function Page() {
  return <CompaniesAdmin />;
}

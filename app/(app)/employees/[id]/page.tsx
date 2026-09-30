import type { Metadata } from "next";
import { EmployeeDetail } from "@/components/employees/employee-detail";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeDetail id={id} />;
}

import type { Metadata } from "next";
import { EditGuard } from "@/components/employees/edit-guard";
import { EmployeeEdit } from "@/components/employees/employee-editor";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EditGuard>
      <EmployeeEdit id={id} />
    </EditGuard>
  );
}

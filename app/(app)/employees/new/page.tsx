import type { Metadata } from "next";
import { EditGuard } from "@/components/employees/edit-guard";
import { EmployeeCreate } from "@/components/employees/employee-editor";

export const metadata: Metadata = { title: "Add employee" };

export default function NewEmployeePage() {
  return (
    <EditGuard>
      <EmployeeCreate />
    </EditGuard>
  );
}

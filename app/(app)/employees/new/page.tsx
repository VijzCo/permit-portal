import type { Metadata } from "next";
import { EmployeeCreate } from "@/components/employees/employee-editor";

export const metadata: Metadata = { title: "Add employee" };

export default function NewEmployeePage() {
  return <EmployeeCreate />;
}

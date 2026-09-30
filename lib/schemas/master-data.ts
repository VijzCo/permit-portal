import { z } from "zod";
import { requiredText } from "@/lib/schemas/common";

// ---------------------------------------------------------------- companies
export const companyInputSchema = z.object({
  name: requiredText("Name"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Code must be 2–10 letters or digits"),
  active: z.boolean(),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export interface Company extends CompanyInput {
  id: string;
  createdAt: string | null;
}

// -------------------------------------------------------------- departments
export const departmentInputSchema = z.object({
  name: requiredText("Name"),
  companyId: z.string().min(1, "Company is required"),
  active: z.boolean(),
});
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export interface Department extends DepartmentInput {
  id: string;
}

// ------------------------------------------------------------- designations
export const designationInputSchema = z.object({
  name: requiredText("Name"),
  active: z.boolean(),
});
export type DesignationInput = z.infer<typeof designationInputSchema>;

export interface Designation extends DesignationInput {
  id: string;
}

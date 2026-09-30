import { z } from "zod";
import {
  isoDateSchema,
  optionalEmailSchema,
  requiredText,
  type AuditFields,
} from "@/lib/schemas/common";

export const passportSchema = z
  .object({
    number: requiredText("Passport number", 30),
    nationality: requiredText("Nationality", 60),
    issueDate: isoDateSchema,
    expiryDate: isoDateSchema,
  })
  .refine((p) => p.expiryDate > p.issueDate, {
    message: "Passport expiry must be after the issue date",
    path: ["expiryDate"],
  });
export type Passport = z.infer<typeof passportSchema>;

/** Form / write input. Denormalised names are added by the repository. */
export const employeeInputSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: requiredText("Last name", 60),
  email: optionalEmailSchema,
  companyId: z.string().min(1, "Company is required"),
  departmentId: z.string().min(1, "Department is required"),
  designationId: z.string().min(1, "Designation is required"),
  passport: passportSchema,
  active: z.boolean(),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

/** `employees/{id}` as read from Firestore. */
export interface Employee extends EmployeeInput, AuditFields {
  id: string;
  companyName: string;
  departmentName: string;
  designationName: string;
  /** lower-case "first last email", used for client-side search */
  searchText: string;
}

export function employeeFullName(e: Pick<EmployeeInput, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export function buildSearchText(e: Pick<EmployeeInput, "firstName" | "lastName" | "email">): string {
  return `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().replace(/\s+/g, " ").trim();
}

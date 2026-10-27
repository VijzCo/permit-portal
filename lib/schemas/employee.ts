import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
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

// ---------------------------------------------------------------------------
// Add-employee form: employee + optional first work permit / visa
// ---------------------------------------------------------------------------

/** Optional first work permit or visa entered on the Add employee form. Validated only when `enabled`. */
export const initialAuthorisationSchema = z
  .object({
    enabled: z.boolean(),
    referenceNumber: z.string().trim().max(60, "Reference number must be at most 60 characters"),
    issuedDate: z.string(),
    expiryDate: z.string(),
    notes: z.string().trim().max(1000, "Notes must be at most 1000 characters"),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    if (!v.referenceNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referenceNumber"], message: "Reference number is required" });
    }
    const issuedOk = isIsoDate(v.issuedDate);
    if (!issuedOk) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["issuedDate"], message: "Use a valid date (YYYY-MM-DD)" });
    }
    if (!isIsoDate(v.expiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "Use a valid date (YYYY-MM-DD)" });
    } else if (issuedOk && v.expiryDate <= v.issuedDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "Expiry must be after the issued date" });
    }
  });
export type InitialAuthorisation = z.infer<typeof initialAuthorisationSchema>;

export const employeeFormSchema = employeeInputSchema.extend({
  workPermit: initialAuthorisationSchema,
  visa: initialAuthorisationSchema,
});
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function splitEmployeeForm(values: EmployeeFormValues): {
  employee: EmployeeInput;
  workPermit: InitialAuthorisation | null;
  visa: InitialAuthorisation | null;
} {
  const { workPermit, visa, ...employee } = values;
  return { employee, workPermit: workPermit.enabled ? workPermit : null, visa: visa.enabled ? visa : null };
}

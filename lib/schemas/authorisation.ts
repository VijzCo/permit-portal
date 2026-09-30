import { z } from "zod";
import { AUTHORISATION_TYPES } from "@/lib/status";
import { isoDateSchema, requiredText, type AuditFields } from "@/lib/schemas/common";

export const authorisationTypeSchema = z.enum(AUTHORISATION_TYPES);

/** Form input for add / edit / renew. */
export const authorisationInputSchema = z
  .object({
    type: authorisationTypeSchema,
    referenceNumber: requiredText("Reference number", 60),
    issuedDate: isoDateSchema,
    expiryDate: isoDateSchema,
    notes: z.string().trim().max(1000, "Notes must be at most 1000 characters"),
  })
  .refine((a) => a.expiryDate > a.issuedDate, {
    message: "Expiry must be after the issued date",
    path: ["expiryDate"],
  });
export type AuthorisationInput = z.infer<typeof authorisationInputSchema>;

/** `authorisations/{id}` as read from Firestore. */
export interface Authorisation extends AuthorisationInput, AuditFields {
  id: string;
  employeeId: string;
  companyId: string;
  isCurrent: boolean;
  supersededBy: string | null;
}

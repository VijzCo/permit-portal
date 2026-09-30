import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/** `YYYY-MM-DD`, real calendar date. */
export const isoDateSchema = z
  .string({ required_error: "Date is required" })
  .refine((v) => isIsoDate(v), { message: "Use a valid date (YYYY-MM-DD)" });

/** Firestore document id. */
export const idSchema = z.string().min(1, "Required").max(128);

export const requiredText = (label: string, max = 120) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

/** Empty string allowed, otherwise must be a valid email. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  });

/**
 * Audit fields as exposed by the repositories. Firestore stores
 * server timestamps; repositories convert them to ISO datetime strings
 * (null while a pending server write has not resolved).
 */
export interface AuditFields {
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

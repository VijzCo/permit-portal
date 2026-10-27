import { z } from "zod";
import { emailSchema, requiredText } from "@/lib/schemas/common";

export const ROLES = ["admin", "hr", "viewer"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const userFieldsSchema = z.object({
  email: emailSchema,
  displayName: requiredText("Display name"),
  role: roleSchema,
  companyIds: z.array(z.string().min(1)).max(30),
  active: z.boolean(),
});

const hrNeedsCompany = {
  check: (u: { role: Role; companyIds: string[] }) => u.role === "admin" || u.companyIds.length > 0,
  message: { message: "HR and viewer users need at least one company", path: ["companyIds"] },
};

export const userInputSchema = userFieldsSchema.refine(hrNeedsCompany.check, hrNeedsCompany.message);
export type UserInput = z.infer<typeof userInputSchema>;

/** Invite form: profile + the temporary password the admin gives the user. */
export const createUserSchema = userFieldsSchema
  .extend({
    temporaryPassword: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "At most 128 characters"),
  })
  .refine(hrNeedsCompany.check, hrNeedsCompany.message);
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** `users/{uid}` — id is the Firebase Auth uid. */
export interface AppUser extends UserInput {
  id: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr: "HR",
  viewer: "Viewer",
};

/** Only admins and HR can change data; viewers are read-only. */
export function canEditRole(role: Role): boolean {
  return role === "admin" || role === "hr";
}

/** Admins see every company; HR and viewers see only `companyIds`. */
export function accessibleCompanyIds(user: AppUser, allCompanyIds: readonly string[]): string[] {
  if (user.role === "admin") return [...allCompanyIds];
  return user.companyIds.filter((id) => allCompanyIds.includes(id));
}

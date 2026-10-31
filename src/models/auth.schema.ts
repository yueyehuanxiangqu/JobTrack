import { z } from "zod";

export const USERNAME_HINT = "3–32 characters: letters, numbers, periods, underscores or hyphens. Start with a letter or number. Usernames are case-insensitive.";

export const UsernameSchema = z.string({ error: "Username is required." })
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be 32 characters or fewer.")
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Use letters, numbers, periods, underscores or hyphens; start with a letter or number.")
  .transform((value) => value.toLowerCase());

export const NewPasswordSchema = z.string({ error: "Password is required." })
  .min(6, "Password must be at least 6 characters.")
  .max(72, "Password must fit within 72 UTF-8 bytes.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must fit within 72 UTF-8 bytes.");

// Existing bcrypt passwords may be longer. Keep them usable during migration.
export const ExistingPasswordSchema = z.string().min(1, "Password is required.");

export const LegacyMigrationSchema = z.object({
  email: z.string().trim().email("Enter the email used for your existing account."),
  password: ExistingPasswordSchema,
  username: UsernameSchema,
});

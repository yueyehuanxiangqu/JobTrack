import "server-only";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { SignupFormSchema } from "@/models/signupForm.schema";
import { SigninFormSchema } from "@/models/signinForm.schema";
import { LegacyMigrationSchema } from "@/models/auth.schema";
import { CONTACT_ROLES, JOB_SOURCES, JOB_STAGES, JOB_STATUSES } from "@/lib/constants";

const usernameTaken = { error: "This username is already taken." };
export type AccountResult = { success: true } | { error: string };
const isUniqueConflict = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export async function registerAccount(input: unknown): Promise<AccountResult> {
  const parsed = SignupFormSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) return usernameTaken;
  const hash = await bcrypt.hash(password, 10);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: username, username, password: hash } });
      await tx.jobSource.createMany({ data: JOB_SOURCES.map((source) => ({ ...source, createdBy: user.id })) });
      await tx.contactRole.createMany({ data: CONTACT_ROLES.map((role) => ({ ...role, createdBy: user.id })) });
      for (const status of JOB_STATUSES) await tx.jobStatus.upsert({ where: { value: status.value }, update: {}, create: status });
      const statuses = await tx.jobStatus.findMany({ select: { id: true, value: true } });
      const ids = new Map(statuses.map((status) => [status.value, status.id]));
      await tx.jobStageType.createMany({ data: JOB_STAGES.map(({ status, ...stage }) => ({ ...stage, statusId: ids.get(status)!, createdBy: user.id })) });
    });
    return { success: true };
  } catch (error) {
    if (isUniqueConflict(error)) return usernameTaken;
    // ORM errors can include query values. Never log the error or user input.
    return { error: "Unable to create the account. Please try again." };
  }
}

export async function authorizeUsername(input: unknown) {
  const parsed = SigninFormSchema.safeParse(input);
  if (!parsed.success) return null;
  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !await bcrypt.compare(parsed.data.password, user.password)) return null;
  return { id: user.id, name: user.name, email: user.email, username: user.username };
}

export async function migrateLegacyAccount(input: unknown): Promise<AccountResult> {
  const parsed = LegacyMigrationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, username } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.username || !await bcrypt.compare(password, user.password)) {
    return { error: "The existing account could not be verified, or it already has a username." };
  }
  try {
    // Compare-and-set makes the transition one-time even for concurrent calls.
    const result = await prisma.user.updateMany({ where: { id: user.id, username: null }, data: { username } });
    if (result.count !== 1) return { error: "This account already has a username. Sign in with that username." };
    return { success: true };
  } catch (error) {
    if (isUniqueConflict(error)) return usernameTaken;
    return { error: "Unable to set the username. Your existing account was not replaced." };
  }
}

"use server";
import prisma from "@/lib/db";
import type { ContactInfo } from "@/models/profile.model";
import { getCurrentUser } from "@/utils/user.utils";

// Returns a bare value rather than a result envelope, matching the shape of
// getDefaultResumeId next door. Null means "no letterhead" — the letter then
// degrades to date + body.
//
// getCurrentUser, not this module's usual requireUser: "no session" has to
// return null like every other no-letterhead case, not throw past the caller.
// Do not "fix" this into requireUser — the null is the contract.
export const getDefaultContactInfo = async (): Promise<ContactInfo | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultResumeId: true },
  });
  if (!row?.defaultResumeId) return null;

  // Ownership chain, never the resume id alone.
  const contactInfo = await prisma.contactInfo.findFirst({
    where: {
      resumeId: row.defaultResumeId,
      resume: { profile: { userId: user.id } },
    },
  });
  return (contactInfo as ContactInfo | null) ?? null;
};

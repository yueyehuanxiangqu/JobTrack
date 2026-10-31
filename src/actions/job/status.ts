"use server";
import prisma from "@/lib/db";
import { resolveStageTypeForStatusId } from "@/lib/jobs/resolve";
import { handleError } from "@/lib/utils";
import { JobStatus } from "@/models/job.model";
import { revalidatePath } from "next/cache";
import { jobFieldsForStage } from "../jobStage/shared";
import { requireUser } from "../shared";
import { appendStatusStage } from "./shared";

export const updateJobStatus = async (
  jobId: string,
  status: JobStatus,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const owned = await prisma.job.count({
      where: { id: jobId, userId: user.id },
    });
    if (owned === 0) throw new Error("Job not found");

    // Outside the transaction on purpose: this resolve can create a row, and
    // it writes through the base client (D4).
    const stageTypeId = await resolveStageTypeForStatusId(status.id, user.id);

    const job = await prisma.$transaction(async (tx: any) => {
      await appendStatusStage(tx, jobId, status.id, stageTypeId, user.id);
      const existing = await tx.job.findFirst({
        where: { id: jobId, userId: user.id },
        select: { appliedDate: true },
      });
      return tx.job.update({
        where: { id: jobId, userId: user.id },
        data: jobFieldsForStage(
          status.value,
          status.id,
          null,
          existing?.appliedDate ?? null,
        ),
      });
    });

    revalidatePath("/dashboard");
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to update job status.";
    return handleError(error, msg);
  }
};

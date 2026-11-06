import prisma from "@/lib/db";
import { calculatePercentageDifference } from "@/lib/utils";
import { requireUser } from "../shared";
import { getLocalDayRange } from "./shared";

export interface JobsSummary {
  jobsApplied: number;
  jobsTrend: number;
}

export const getJobsSummary = async (days: number): Promise<JobsSummary> => {
  const user = await requireUser();
  const { start, end } = getLocalDayRange(days - 1);
  const { start: priorStart } = getLocalDayRange(days * 2 - 1);
  const [jobsApplied, priorJobs] = await prisma.$transaction([
    prisma.job.count({
      where: { userId: user.id, applied: true, appliedDate: { gte: start, lte: end } },
    }),
    prisma.job.count({
      where: { userId: user.id, applied: true, appliedDate: { gte: priorStart, lt: start } },
    }),
  ]);
  return {
    jobsApplied,
    jobsTrend: calculatePercentageDifference(priorJobs, jobsApplied) ?? 0,
  };
};

import { APP_CONSTANTS } from "@/lib/constants";
import prisma from "@/lib/db";
import { requireUser } from "../shared";

export const getRecentJobs = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const list = await prisma.job.findMany({
      where: {
        userId: user.id,
        applied: true,
      },
      include: {
        JobSource: true,
        JobTitle: true,
        Company: true,
        Status: true,
        Location: true,
      },
      orderBy: {
        appliedDate: "desc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS,
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};

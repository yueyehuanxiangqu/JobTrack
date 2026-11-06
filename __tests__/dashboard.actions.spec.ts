import {
  getJobsSummary,
  getRecentJobs,
  getJobsForPeriod,
  getActivityCalendarData,
} from "@/actions/dashboard.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mock the Prisma Client
vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    activity: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { PrismaClient: vi.fn(function() { return mPrismaClient; }) };
});

vi.mock("@/utils/user.utils", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Dashboard Actions", () => {
  const mockUser = { id: "user-id" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentJobs", () => {
    it("should return recent jobs for authenticated user", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      const mockJobs = [
        {
          id: "job-1",
          title: "Software Engineer",
          Company: { label: "Company 1" },
          Status: { label: "Applied" },
        },
        {
          id: "job-2",
          title: "Frontend Developer",
          Company: { label: "Company 2" },
          Status: { label: "Interview" },
        },
      ];
      (prisma.job.findMany as any).mockResolvedValue(mockJobs);

      const result = await getRecentJobs();

      expect(result).toEqual(mockJobs);
      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
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
    });

    it("should throw error when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      await expect(getRecentJobs()).rejects.toThrow(
        "Failed to fetch jobs list. ",
      );
    });

    it("should handle database errors", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findMany as any).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(getRecentJobs()).rejects.toThrow(
        "Failed to fetch jobs list. ",
      );
    });

    it("should return empty array when no jobs found", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.findMany as any).mockResolvedValue([]);

      const result = await getRecentJobs();

      expect(result).toEqual([]);
    });
  });

  describe("getJobsForPeriod", () => {
    it("should return jobs activity data for authenticated user", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      const mockJobData = [
        {
          appliedDate: new Date("2024-01-01"),
          _count: { _all: 3 },
        },
        {
          appliedDate: new Date("2024-01-02"),
          _count: { _all: 5 },
        },
      ];
      (prisma.job.groupBy as any).mockResolvedValue(mockJobData);

      const result = await getJobsForPeriod();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(7);
      result.forEach((item: any) => {
        expect(item).toHaveProperty("day");
        expect(item).toHaveProperty("value");
        expect(typeof item.value).toBe("number");
      });
    });

    it("should throw error when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      await expect(getJobsForPeriod()).rejects.toThrow(
        "Failed to fetch jobs list. ",
      );
    });

    it("should handle database errors", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.groupBy as any).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(getJobsForPeriod()).rejects.toThrow(
        "Failed to fetch jobs list. ",
      );
    });

    it("should return zero values for days with no jobs", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.job.groupBy as any).mockResolvedValue([]);

      const result = await getJobsForPeriod();

      expect(result.length).toBe(7);
      result.forEach((item: any) => {
        expect(item.value).toBe(0);
      });
    });
  });
});


describe("Application-only dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-id" } as any);
  });
  it("counts current and previous application periods without querying Activity", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([3, 2]);
    expect(await getJobsSummary(7)).toEqual({ jobsApplied: 3, jobsTrend: 50 });
    expect(prisma.job.count).toHaveBeenCalledTimes(2);
    expect(prisma.job.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-id", applied: true }),
    }));
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });
  it("keeps an empty period at zero jobs", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([0, 0]);
    expect(await getJobsSummary(30)).toEqual({ jobsApplied: 0, jobsTrend: 0 });
  });
  it("requires authentication before counting applications", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getJobsSummary(7)).rejects.toThrow("Not authenticated");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("groups application counts by local date without reading Activity hours", async () => {
    vi.mocked(prisma.job.groupBy).mockResolvedValue([
      { appliedDate: new Date(2026, 10, 1, 8), _count: { _all: 2 } },
      { appliedDate: new Date(2026, 10, 1, 16), _count: { _all: 5 } },
    ] as any);
    expect(await getActivityCalendarData()).toEqual({ "2026": [{ day: "2026-11-01", value: 7 }] });
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
    expect(prisma.job.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-id", applied: true }),
    }));
  });
  it("returns an empty calendar when no applications exist", async () => {
    vi.mocked(prisma.job.groupBy).mockResolvedValue([]);
    expect(await getActivityCalendarData()).toEqual({});
  });
});

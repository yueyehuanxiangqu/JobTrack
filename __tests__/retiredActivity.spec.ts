// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { deleteTaskById } from "@/actions/task.actions";
import { collectBackupData } from "@/lib/backup/export";
import { getCurrentUser } from "@/utils/user.utils";
import { seedAccount } from "./helpers/backupTestDb";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("./helpers/backupTestDb");
  const result = helpers.makeTestDbUrl();
  helpers.deploySchema(result.url);
  return result;
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

afterAll(async () => {
  const db = (await import("@/lib/db")).default;
  await db.$disconnect();
  await prisma.$disconnect();
  const target = path.resolve(ctx.dir);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("jobsync-backup-")) throw new Error("Unexpected temporary directory");
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

it("preserves historical Activity data in SQLite and backups when its Task is deleted", async () => {
  const userId = await seedAccount(prisma, "retired-activity@example.test");
  vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as any);
  const category = await prisma.activityType.create({ data: { createdBy: userId, label: "Preparation", value: "preparation" } });
  const task = await prisma.task.create({ data: { userId, title: "Prepare", activityTypeId: category.id } });
  const activity = await prisma.activity.create({ data: {
    userId, activityName: "Historical preparation", activityTypeId: category.id, taskId: task.id,
    startTime: new Date("2026-11-01T10:00:00Z"), endTime: new Date("2026-11-01T10:30:00Z"), duration: 30,
  } });
  expect(await deleteTaskById(task.id)).toEqual({ success: true });
  expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
  expect(await prisma.activity.findUnique({ where: { id: activity.id } })).toMatchObject({ taskId: null, duration: 30 });
  const backup = await collectBackupData(userId);
  expect(backup.Activity).toEqual(expect.arrayContaining([expect.objectContaining({ id: activity.id, taskId: null, duration: 30 })]));
});

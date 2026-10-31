// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { authorizeUsername, migrateLegacyAccount, registerAccount } from "@/lib/auth/accounts";
import { UsernameSchema, NewPasswordSchema } from "@/models/auth.schema";
import { seedAccount } from "./helpers/backupTestDb";
import { encrypt, decrypt } from "@/lib/encryption";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("./helpers/backupTestDb");
  const db = helpers.makeTestDbUrl();
  helpers.deploySchema(db.url);
  return db;
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});

const password = "Local-fixture-123";
let legacyId: string;
let legacyBefore: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>;
let jobId: string;
let resumeId: string;
let fileId: string;
let apiKeyId: string;
const filePath = path.join(ctx.dir, "履歷 CV.pdf");

beforeAll(async () => {
  vi.stubEnv("ENCRYPTION_KEY", "phase3-test-encryption-key-not-for-production");
  expect(await registerAccount({ username: "  Alice.Test  ", password })).toEqual({ success: true });
  legacyId = await seedAccount(prisma, "legacy@example.test");
  await prisma.user.update({ where: { id: legacyId }, data: { password: await bcrypt.hash(password, 10) } });
  const company = await prisma.company.create({ data: { label: "Legacy company", value: "legacy company", createdBy: legacyId } });
  const title = await prisma.jobTitle.create({ data: { label: "Legacy job", value: "legacy job", createdBy: legacyId } });
  const status = await prisma.jobStatus.findUniqueOrThrow({ where: { value: "applied" } });
  const profile = await prisma.profile.create({ data: { userId: legacyId } });
  fs.writeFileSync(filePath, "%PDF-1.4\nlegacy fixture");
  const file = await prisma.file.create({ data: { fileName: "履歷 CV.pdf", filePath, fileType: "application/pdf" } });
  fileId = file.id;
  const resume = await prisma.resume.create({ data: { title: "Legacy CV", profileId: profile.id, FileId: file.id } });
  resumeId = resume.id;
  const job = await prisma.job.create({ data: { userId: legacyId, companyId: company.id, jobTitleId: title.id, statusId: status.id, description: "Original legacy application", createdAt: new Date(), jobType: "Full-time", applied: true, appliedDate: new Date(), resumeId } });
  jobId = job.id;
  await prisma.task.create({ data: { userId: legacyId, title: "Legacy task" } });
  const type = await prisma.activityType.create({ data: { createdBy: legacyId, label: "Search", value: "search" } });
  await prisma.activity.create({ data: { userId: legacyId, activityName: "Legacy activity", activityTypeId: type.id, startTime: new Date(), duration: 30 } });
  const encrypted = encrypt("fake-fixture-provider-key");
  const key = await prisma.apiKey.create({ data: { userId: legacyId, provider: "openai", encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: "-key" } });
  apiKeyId = key.id;
  legacyBefore = await prisma.user.findUniqueOrThrow({ where: { id: legacyId } });
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  vi.unstubAllEnvs();
  const target = path.resolve(ctx.dir);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("jobsync-backup-")) throw new Error("Unexpected test directory");
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

it("registers a normalized username with a real hash, null email and seeded references", async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { username: "alice.test" } });
  expect(user.email).toBeNull();
  expect(user.password).not.toBe(password);
  expect(await bcrypt.compare(password, user.password)).toBe(true);
  expect(await prisma.jobSource.count({ where: { createdBy: user.id } })).toBeGreaterThan(0);
  expect(await prisma.jobStageType.count({ where: { createdBy: user.id } })).toBeGreaterThan(0);
});

it("rejects case/whitespace duplicates, including direct DB writes bypassing normalization", async () => {
  expect(await registerAccount({ username: " ALICE.TEST ", password })).toEqual({ error: "This username is already taken." });
  await expect(prisma.user.create({ data: { name: "duplicate", username: "ALICE.TEST", password: "unused" } })).rejects.toMatchObject({ code: "P2002" });
});

it.each(["", "  ", "ab", "a b", "@admin", "x' OR 1=1 --", "a".repeat(33)])("rejects invalid username %j", (username) => {
  expect(UsernameSchema.safeParse(username).success).toBe(false);
});

it("rejects passwords that bcrypt would silently truncate", () => {
  expect(NewPasswordSchema.safeParse("a".repeat(73)).success).toBe(false);
  expect(NewPasswordSchema.safeParse("字".repeat(25)).success).toBe(false);
});

it("authenticates case-insensitively and never returns the password hash", async () => {
  const user = await authorizeUsername({ username: " ALICE.TEST ", password });
  expect(user?.username).toBe("alice.test");
  expect(user).not.toHaveProperty("password");
  expect(await authorizeUsername({ username: "alice.test", password: "incorrect" })).toBeNull();
  expect(await authorizeUsername({ email: "legacy@example.test", password })).toBeNull();
});

it("does not migrate an unknown account, wrong password, or claimed username", async () => {
  for (const input of [
    { email: "unknown@example.test", password, username: "legacy" },
    { email: "legacy@example.test", password: "incorrect", username: "legacy" },
    { email: "legacy@example.test", password, username: "Alice.Test" },
  ]) expect(await migrateLegacyAccount(input)).toHaveProperty("error");
  expect(await prisma.user.findUniqueOrThrow({ where: { id: legacyId } })).toEqual(legacyBefore);
});

it("migrates once while preserving the same account, job, file, task, activity and encrypted key", async () => {
  expect(await migrateLegacyAccount({ email: "legacy@example.test", password, username: " Legacy.User " })).toEqual({ success: true });
  const after = await prisma.user.findUniqueOrThrow({ where: { id: legacyId } });
  expect(after).toEqual({ ...legacyBefore, username: "legacy.user" });
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  expect(job.userId).toBe(legacyId);
  expect(job.resumeId).toBe(resumeId);
  expect((await prisma.file.findUniqueOrThrow({ where: { id: fileId } })).filePath).toBe(filePath);
  expect(fs.readFileSync(filePath, "utf8")).toContain("legacy fixture");
  expect(await prisma.task.count({ where: { userId: legacyId } })).toBe(1);
  expect(await prisma.activity.count({ where: { userId: legacyId } })).toBe(1);
  const key = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKeyId } });
  expect(decrypt(key.encryptedKey, key.iv)).toBe("fake-fixture-provider-key");
  expect((await authorizeUsername({ username: "LEGACY.USER", password }))?.id).toBe(legacyId);
  expect(await migrateLegacyAccount({ email: "legacy@example.test", password, username: "replacement" })).toHaveProperty("error");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: legacyId } })).username).toBe("legacy.user");
});

it("keeps the new and migrated identities separate", async () => {
  const alice = await authorizeUsername({ username: "alice.test", password });
  const legacy = await authorizeUsername({ username: "legacy.user", password });
  expect(alice?.id).not.toBe(legacy?.id);
  expect(await prisma.job.count({ where: { userId: alice!.id } })).toBe(0);
  expect(await prisma.job.count({ where: { userId: legacy!.id } })).toBe(1);
});

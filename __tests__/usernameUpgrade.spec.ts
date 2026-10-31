// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { deploySchema, makeTestDbUrl } from "./helpers/backupTestDb";

it("formally upgrades a 44-migration database without changing account or attachment relationships", async () => {
  const ctx = makeTestDbUrl();
  const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
  try {
    const schemaDir = path.join(ctx.dir, "prisma");
    fs.mkdirSync(path.join(schemaDir, "migrations"), { recursive: true });
    const schema = fs.readFileSync("prisma/schema.prisma", "utf8")
      .replace(/^\s*username\s+String\?\s+@unique.*\r?\n/m, "")
      .replace(/^(\s*email\s+)String\?(\s+@unique)/m, "$1String$2");
    fs.writeFileSync(path.join(schemaDir, "schema.prisma"), schema);
    for (const name of fs.readdirSync("prisma/migrations")) {
      if (name === "20261031110000_username_authentication") continue;
      fs.cpSync(path.join("prisma/migrations", name), path.join(schemaDir, "migrations", name), { recursive: true });
    }
    execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(schemaDir, "schema.prisma")], {
      env: { ...process.env, DATABASE_URL: ctx.url }, stdio: "pipe",
    });
    await prisma.$executeRaw`INSERT INTO "User" (id, name, email, password, createdAt) VALUES ('upgrade-user', 'Original name', 'upgrade@example.test', 'original-fixture-hash', CURRENT_TIMESTAMP)`;
    const company = await prisma.company.create({ data: { label: "Original company", value: "original company", createdBy: "upgrade-user" } });
    const title = await prisma.jobTitle.create({ data: { label: "Original job", value: "original job", createdBy: "upgrade-user" } });
    const status = await prisma.jobStatus.upsert({ where: { value: "applied" }, update: {}, create: { value: "applied", label: "Applied" } });
    const profile = await prisma.profile.create({ data: { userId: "upgrade-user" } });
    const file = await prisma.file.create({ data: { fileName: "原有 CV.pdf", filePath: path.join(ctx.dir, "原有 CV.pdf"), fileType: "application/pdf" } });
    fs.writeFileSync(file.filePath, "%PDF-1.4\noriginal file");
    const resume = await prisma.resume.create({ data: { title: "Original CV", profileId: profile.id, FileId: file.id } });
    await prisma.$executeRaw`UPDATE "User" SET defaultResumeId = ${resume.id} WHERE id = 'upgrade-user'`;
    const job = await prisma.job.create({ data: { userId: "upgrade-user", jobTitleId: title.id, companyId: company.id, statusId: status.id, createdAt: new Date(), jobType: "Full-time", description: "Original application", resumeId: resume.id } });
    const before = await prisma.$queryRaw`SELECT id, name, email, password, createdAt, defaultResumeId FROM "User"`;
    await prisma.$disconnect();

    deploySchema(ctx.url);

    expect(await prisma.$queryRaw`SELECT id, name, email, password, createdAt, defaultResumeId FROM "User"`).toEqual(before);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "upgrade-user" } })).username).toBeNull();
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toEqual(job);
    expect(await prisma.file.findUniqueOrThrow({ where: { id: file.id } })).toEqual(file);
    expect(fs.readFileSync(file.filePath, "utf8")).toContain("original file");
    expect(await prisma.$queryRaw`PRAGMA foreign_key_check`).toEqual([]);
    // A second deploy must be a no-op rather than attempting another table copy.
    await prisma.$disconnect();
    deploySchema(ctx.url);
    expect(await prisma.$queryRaw`SELECT id, name, email, password, createdAt, defaultResumeId FROM "User"`).toEqual(before);
  } finally {
    await prisma.$disconnect();
    const target = path.resolve(ctx.dir);
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("jobsync-backup-")) throw new Error("Unexpected test directory");
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 120_000);

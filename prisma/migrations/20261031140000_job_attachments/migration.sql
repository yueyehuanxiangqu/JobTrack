CREATE TABLE "JobAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL CHECK ("kind" IN ('CV', 'COVER_LETTER')),
    "fileId" TEXT NOT NULL,
    "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 10485760),
    CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobAttachment_fileId_key" ON "JobAttachment"("fileId");
CREATE UNIQUE INDEX "JobAttachment_jobId_kind_key" ON "JobAttachment"("jobId", "kind");

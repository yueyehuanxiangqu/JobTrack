-- Keep user IDs, password hashes and relationships. Legacy users explicitly
-- verify their old credentials before choosing a username; none are invented.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT COLLATE NOCASE,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultResumeId" TEXT,
    CONSTRAINT "User_defaultResumeId_fkey" FOREIGN KEY ("defaultResumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("id", "name", "email", "password", "createdAt", "defaultResumeId")
SELECT "id", "name", "email", "password", "createdAt", "defaultResumeId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
COMMIT;
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

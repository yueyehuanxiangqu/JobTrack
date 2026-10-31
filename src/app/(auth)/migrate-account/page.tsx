import type { Metadata } from "next";
import LegacyMigrationForm from "@/components/auth/LegacyMigrationForm";

export const metadata: Metadata = { title: "Set your username" };

export default function MigrateAccount() {
  return (
    <div className="mx-auto w-full max-w-md px-4">
      <h1 className="mb-6 text-center text-3xl font-bold">JobSync</h1>
      <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-6 shadow-xs">
        <h2 className="mb-4 text-xl font-semibold">Set your username</h2>
        <LegacyMigrationForm />
      </div>
    </div>
  );
}

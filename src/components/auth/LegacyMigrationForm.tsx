"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setLegacyUsername, authenticate } from "@/actions/auth.actions";
import { LegacyMigrationSchema, USERNAME_HINT } from "@/models/auth.schema";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export default function LegacyMigrationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = LegacyMigrationSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => {
      setError("");
      const result = await setLegacyUsername(parsed.data);
      if ("error" in result) { setError(result.error); return; }
      const credentials = new FormData();
      credentials.set("username", parsed.data.username);
      credentials.set("password", parsed.data.password);
      const signInError = await authenticate(undefined, credentials);
      if (signInError) { setError("Username saved. Return to sign in with your new username."); return; }
      router.push("/dashboard");
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Verify your existing email and password once, then choose a username.
        Your account, applications and files stay in place. This cannot change a username already set.
      </p>
      <div className="grid gap-2">
        <label htmlFor="legacy-email">Original email</label>
        <Input id="legacy-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <label htmlFor="legacy-password">Current password</label>
        <Input id="legacy-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-2">
        <label htmlFor="legacy-username">Username</label>
        <Input id="legacy-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32} required />
        <p className="text-xs text-muted-foreground">{USERNAME_HINT}</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Verifying…" : "Set username"}</Button>
      <p role="status" aria-live="polite" className="text-sm text-red-500">{error}</p>
      <Link href="/signin" className="text-sm text-primary hover:underline">Back to sign in</Link>
    </form>
  );
}

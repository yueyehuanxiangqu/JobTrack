"use server";
import { AuthError } from "next-auth";
import { signIn } from "../auth";
import { delay } from "@/utils/delay";
import { registerAccount, migrateLegacyAccount } from "@/lib/auth/accounts";

export async function signup(input: { username: string; password: string }) {
  return registerAccount(input);
}

export async function setLegacyUsername(input: { email: string; password: string; username: string }) {
  await delay(1000);
  return migrateLegacyAccount(input);
}

export async function authenticate(_previous: string | undefined, formData: FormData) {
  try {
    await delay(1000);
    await signIn("credentials", { username: formData.get("username"), password: formData.get("password"), redirect: false });
    return null;
  } catch (error) {
    if (error instanceof AuthError) return error.type === "CredentialsSignin" ? "Invalid username or password." : "Unable to sign in. Please try again.";
    throw error;
  }
}

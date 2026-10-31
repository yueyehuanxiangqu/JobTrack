import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authorizeUsername } from "./lib/auth/accounts";
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Credentials({ authorize: authorizeUsername })],
});

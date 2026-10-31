import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      username?: string | null;
    };
  }
}

export const authConfig = {
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isApiRoute = nextUrl.pathname.startsWith("/api");

      if (isOnDashboard || isApiRoute) {
        return isLoggedIn;
      } else if (isLoggedIn && nextUrl.pathname !== "/migrate-account") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = (token.id as string) || token.sub;
      if (userId) {
        session.user.id = userId;
        session.user.username = typeof token.username === "string" ? token.username : null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

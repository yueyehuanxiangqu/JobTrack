import { GlobalActivityBanner } from "@/components/activities/GlobalActivityBanner";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import SidebarInset from "@/components/SidebarInset";
import { ActivityProvider } from "@/context/ActivityContext";
import { RightRailProvider } from "@/context/RightRailContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { cookies } from "next/headers";

import { signOut } from "@/auth";
import StaleSessionSignOut from "@/components/StaleSessionSignOut";
import { APP_CONSTANTS } from "@/lib/constants";
import { getCurrentUser } from "@/utils/user.utils";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(APP_CONSTANTS.SIDEBAR_STORAGE_KEY);
  const initialExpanded = sidebarCookie ? sidebarCookie.value === "true" : true;

  const user = await getCurrentUser();

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/signin" });
  };

  // The session outlived the database it was minted against: middleware still
  // passes the signed cookie, but the user row is gone and every scoped query
  // would read as empty rather than unauthorized.
  if (!user) {
    return <StaleSessionSignOut signOutAction={signOutAction} />;
  }

  return (
    <ActivityProvider>
      <SidebarProvider initialExpanded={initialExpanded}>
        <RightRailProvider>

              <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <Sidebar user={user} signOutAction={signOutAction} />
                <SidebarInset>
                  <Header />
                  <GlobalActivityBanner />
                  <main className="@container/main flex-1 p-4 sm:px-4 sm:py-0">
                    <div className="items-start gap-4 md:gap-4 @3xl/main:grid @3xl/main:grid-cols-3">
                      {children}
                    </div>
                  </main>
                </SidebarInset>

              </div>

        </RightRailProvider>
      </SidebarProvider>
    </ActivityProvider>
  );
}

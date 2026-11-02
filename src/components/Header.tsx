import { PanelLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import {
Sheet,
SheetClose,
SheetContent,
SheetTitle,
SheetTrigger,
} from "@/components/ui/sheet";
import { SIDEBAR_LINKS } from "@/lib/constants";
import SidebarToggle from "./SidebarToggle";
import { Button } from "./ui/button";
import { ProfileDropdown } from "./ProfileDropdown";
import type { CurrentUser } from "@/models/user.model";
import { TooltipProvider } from "./ui/tooltip";

async function Header({ user, signOutAction }: { user?: CurrentUser; signOutAction?: () => void } = {}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 min-w-0 items-center gap-3 border-b bg-background px-4 lg:static lg:h-auto lg:border-0 lg:bg-transparent lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="shrink-0 lg:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[calc(100vw-2rem)] max-w-xs overflow-y-auto">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <nav className="grid min-w-0 gap-4 text-lg font-medium">
            <SheetClose asChild>
              <Link
                href="/dashboard"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg text-lg font-semibold md:text-base"
              >
                <Image src="/images/jobtrack-logo.svg" width={40} height={40} alt="" className="h-10 w-10 transition-transform group-hover:scale-110" />
                <span className="sr-only">JobTrack</span>
              </Link>
            </SheetClose>
            {SIDEBAR_LINKS.map((item) => {
              // Only show dev-only items in development mode
              if (item.devOnly && process.env.NODE_ENV !== "development") {
                return null;
              }
              return (
                <SheetClose asChild key={item.label}>
                  <Link
                    href={item.route}
                    className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
          {user && signOutAction && <TooltipProvider><div className="mt-6 border-t pt-3"><ProfileDropdown user={user} expanded signOutAction={signOutAction} /></div></TooltipProvider>}
        </SheetContent>
      </Sheet>
      <SidebarToggle />
      <h1 className="min-w-0 break-words font-semibold">
        JobTrack<span className="hidden sm:inline"> - Job Application Tracker</span>
      </h1>
    </header>
  );
}

export default Header;

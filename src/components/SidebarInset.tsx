"use client";
import { useSidebar } from "@/context/SidebarContext";
import { APP_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
export default function SidebarInset({ children }: { children: React.ReactNode }) {
 const { expanded } = useSidebar();
 return <div className={cn("flex flex-1 flex-col sm:gap-4 sm:py-4 transition-[padding] duration-200 ease-in-out", expanded ? APP_CONSTANTS.SIDEBAR_WIDTH.expanded.contentOffset : APP_CONSTANTS.SIDEBAR_WIDTH.collapsed.contentOffset)}>{children}</div>;
}

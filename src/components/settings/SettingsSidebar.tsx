"use client";

import { cn } from "@/lib/utils";
import { Bot,Database,Key,Palette } from "lucide-react";
import { Button } from "../ui/button";

export type SettingsSection = "ai-provider" | "api-keys" | "appearance" | "data";

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof Bot;
}[] = [
  { id: "ai-provider", label: "AI Provider", icon: Bot },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "data", label: "Data", icon: Database },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export default function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex w-full flex-wrap gap-1 lg:w-48 lg:shrink-0 lg:flex-col">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <Button
            key={section.id}
            variant="ghost"
            title={section.label}
            aria-label={section.label}
            className={cn(
              "min-w-0 justify-start gap-2 rounded-none border-l-2 px-3",
              isActive
                ? "border-l-primary bg-muted font-medium"
                : "border-l-transparent hover:border-l-muted-foreground/25",
            )}
            onClick={() => onSectionChange(section.id)}
          >
            <Icon className="h-4 w-4" />
            <span className="min-w-0">{section.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}

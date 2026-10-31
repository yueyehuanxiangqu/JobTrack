"use client";

import { CompanyLogo } from "@/components/myjobs/CompanyLogo";
import { Button } from "@/components/ui/button";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuLabel,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUrl } from "@/lib/utils";
import type { Company } from "@/models/job.model";
import {
ArrowLeft,
ExternalLink,
MoreVertical,
Pencil,
Trash2
} from "lucide-react";
import { hostnameOf } from "./hostname";

type CompanyDetailsHeaderProps = {
  company: Company;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function CompanyDetailsHeader({
  company,
  onBack,
  onEdit,
  onDelete,
}: CompanyDetailsHeaderProps) {
  const subtitle = [company.industry, hostnameOf(company.websiteUrl)]
    .filter(Boolean)
    .join(" · ");

  const links = [
    { label: "Open website", href: company.websiteUrl ? formatUrl(company.websiteUrl) : null },
    { label: "Open careers page", href: company.careersUrl ? formatUrl(company.careersUrl) : null },
    { label: "Open LinkedIn", href: company.linkedinUrl ? formatUrl(company.linkedinUrl) : null },
  ].filter((link): link is { label: string; href: string } => !!link.href);

  return (
    <div className="flex flex-col gap-4 @5xl/main:flex-row @5xl/main:items-center">
      <div className="flex flex-1 min-w-0 items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          title="Go Back"
          aria-label="Back to Companies"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CompanyLogo
          logoUrl={company.logoUrl}
          className="h-10 w-10 min-w-10"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{company.label}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">

        <Button variant="outline" className="cursor-pointer" onClick={onEdit}>
          <Pencil className="h-4 w-4 sm:mr-2" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Edit
          </span>
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive cursor-pointer"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 sm:mr-2" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Delete
          </span>
        </Button>
        {links.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More links</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Links</DropdownMenuLabel>
              {links.map((link) => (
                <DropdownMenuItem key={link.label} className="cursor-pointer" asChild>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {link.label}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

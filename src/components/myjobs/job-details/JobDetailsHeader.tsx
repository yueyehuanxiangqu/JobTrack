"use client";

import { Button } from "@/components/ui/button";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuGroup,
DropdownMenuItem,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
JobResponse,
getJobTypeLabel,
getWorkplaceTypeLabel,
} from "@/models/job.model";
import {
ArrowLeft,
MoreVertical,
Pencil,
StickyNote,
Trash,
Trash2
} from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "../CompanyLogo";

type JobDetailsHeaderProps = {
  job: JobResponse;
  updateStatusMenu?: React.ReactNode;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddNote: () => void;
};

export function JobDetailsHeader({
  job,
  updateStatusMenu,
  onBack,
  onEdit,
  onDelete,
  onAddNote,
}: JobDetailsHeaderProps) {
  const details = [
    job.Location?.label,
    getJobTypeLabel(job.jobType),
    job.workplaceType ? getWorkplaceTypeLabel(job.workplaceType) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 @5xl/main:flex-row @5xl/main:items-center">
      <div className="flex flex-1 min-w-0 items-center gap-4">
        <Button title="Go Back" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CompanyLogo
          logoUrl={job.Company?.logoUrl}
          className="h-10 w-10 min-w-10"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">{job.JobTitle?.label}</h1>
          <p className="text-muted-foreground [overflow-wrap:anywhere]">
            {job.Company?.label && (
              <Link
                href={`/dashboard/admin/companies/${job.Company.id}`}
                className="hover:text-foreground hover:underline underline-offset-4"
              >
                {job.Company.label}
              </Link>
            )}
            {job.Company?.label && details && " · "}
            {details}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {updateStatusMenu}

        <Button
          title="Edit"
          variant="outline"
          size="icon"
          onClick={onEdit}
          data-testid="job-details-edit-btn"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button
          title="Delete"
          variant="outline"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          data-testid="job-details-delete-btn"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-haspopup="true"
              size="icon"
              variant="ghost"
              data-testid="job-details-actions-menu-btn"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Job
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={onAddNote}>
                <StickyNote className="mr-2 h-4 w-4" />
                Add a Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 cursor-pointer"
                onClick={onDelete}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

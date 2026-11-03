"use client";

import { Badge } from "@/components/ui/badge";
import { Card,CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ExternalLink,FileText,Sparkles } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/StatusBadge";
import { DownloadFileButton } from "@/components/profile/DownloadFileButton";
import { BADGE_COLORS,getJobStatusBadgeColor } from "@/lib/badge-colors";
import { cn,formatUrl } from "@/lib/utils";

import {
JobResponse,
JobStatus,
getJobTypeLabel,
getWorkplaceTypeLabel,
} from "@/models/job.model";

type JobSummaryCardProps = {
  job: JobResponse;
  currentStatus: JobStatus;
};

export function JobSummaryCard({
  job,
  currentStatus,
}: JobSummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 [&>*]:min-w-0 [overflow-wrap:anywhere]">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={currentStatus?.label ?? ""}
                  color={getJobStatusBadgeColor(currentStatus?.value ?? "")}
                />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Job Type</p>
            <p className="mt-1 font-medium">
              {getJobTypeLabel(job.jobType)}
              {job.workplaceType &&
                ` · ${getWorkplaceTypeLabel(job.workplaceType)}`}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Salary</p>
            <p className="mt-1 font-medium whitespace-pre-wrap">{job.salaryRange || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Source</p>
            <p className="mt-1 font-medium">{job.JobSource?.label ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Applied</p>
            <p className="mt-1 font-medium">
              {job.appliedDate
                ? format(new Date(job.appliedDate), "PP")
                : job.applied
                  ? "Yes, no date"
                  : "Not applied"}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Resume</p>
            <div className="mt-1 font-medium">
              {job.Resume?.File?.filePath ? (
                DownloadFileButton(
                  job.Resume.id!,
                  job.Resume.File.filePath,
                  job.Resume.title,
                  job.Resume.File.fileName,
                )
              ) : job.Resume?.id ? (
                <Link
                  href={`/dashboard/profile/resume/${job.Resume.id}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {job.Resume.title}
                </Link>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Added</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {job.createdAt ? format(new Date(job.createdAt), "PP") : "-"}
              </span>
              {job.createdVia && (
                <Badge
                  variant="outline"
                  className={cn("gap-1", BADGE_COLORS.violet)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  via {job.createdVia}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(job.jobUrl || (job.tags && job.tags.length > 0)) && (
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-4">
            {job.jobUrl && (
              <a
                href={formatUrl(job.jobUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm hover:underline [overflow-wrap:anywhere]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {job.jobUrl}
              </a>
            )}
            {job.tags && job.tags.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1">
                {job.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

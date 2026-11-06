"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import { JobResponse } from "@/models/job.model";
import { format } from "date-fns";
import Link from "next/link";

export default function RecentJobsCard({ jobs }: { jobs: JobResponse[] }) {
  const groups = new Map<string, JobResponse[]>();
  for (const job of jobs) {
    const date = job.appliedDate ? format(new Date(job.appliedDate), "EEE MMMM d, yyyy") : "No date";
    groups.set(date, [...(groups.get(date) ?? []), job]);
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg text-green-600">Recent Jobs</CardTitle></CardHeader>
      <CardContent className="grid auto-rows-max gap-6 px-4">
        {jobs.length === 0 && <p className="text-sm text-muted-foreground">No applications recorded yet.</p>}
        {[...groups].map(([date, dateJobs]) => (
          <div key={date} className="grid gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{date}</p>
            {dateJobs.map((job) => (
              <div key={job.id} className="flex items-center gap-4">
                <Avatar className="hidden h-8 w-8 sm:flex">
                  <AvatarImage src={job.Company?.logoUrl || "/images/jobtrack-logo.svg"} alt="" />
                  <AvatarFallback>JT</AvatarFallback>
                </Avatar>
                <Link href={`/dashboard/myjobs/${job.id}`} className="min-w-0">
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-medium leading-none">{job.JobTitle?.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{job.Company?.label}{job.Location?.label ? ` · ${job.Location.label}` : ""}</p>
                  </div>
                </Link>
                {job.Status?.label && <StatusBadge label={job.Status.label} color={getJobStatusBadgeColor(job.Status.value)} className="ml-auto h-5 shrink-0 justify-center px-1.5 py-0 text-xs" />}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

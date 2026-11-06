"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobsSummary } from "@/actions/dashboard/stats";
import { usePersistedTabIndex } from "@/hooks/usePersistedTabIndex";
import { cn } from "@/lib/utils";

export default function JobsCountCard({ data }: {
  data: { label: string; summary: JobsSummary }[];
}) {
  const [index, select] = usePersistedTabIndex("dashboard-jobs-count-tab", data.map((d) => d.label));
  const { jobsApplied, jobsTrend } = data[index].summary;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg text-green-600">Jobs Applied</CardTitle>
          <div className="flex rounded-md border text-xs" aria-label="Application count period">
            {data.map(({ label }, i) => (
              <button key={label} onClick={() => select(i)} aria-pressed={index === i}
                className={cn("rounded px-2 py-1", index === i ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[128px] flex-col justify-center gap-2">
        <p className="text-4xl font-bold tabular-nums">{jobsApplied} <span className="text-base font-normal text-muted-foreground">{jobsApplied === 1 ? "job" : "jobs"}</span></p>
        {jobsTrend !== 0 && <p className="text-sm text-muted-foreground">{jobsTrend > 0 ? "+" : ""}{jobsTrend}% vs previous {data[index].label}</p>}
      </CardContent>
    </Card>
  );
}

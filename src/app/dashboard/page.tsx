import {
getActivityCalendarData,
getActivityDataForPeriod,
getJobsActivityForPeriod,
getJobsActivitySummary,
getRecentActivities,
getRecentJobs,
} from "@/actions/dashboard.actions";
import { format } from "date-fns";

import ActivityCalendar from "@/components/dashboard/ActivityCalendar";

import JobsActivityCard from "@/components/dashboard/JobsActivityCard";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  // Server-computed so server and browser agree on "today"
  const today = format(new Date(), "yyyy-MM-dd");
  const [
    summary7Days,
    summary30Days,
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,

  ] = await Promise.all([
    getJobsActivitySummary(7),
    getJobsActivitySummary(30),
    getRecentJobs(),
    getRecentActivities(),
    getJobsActivityForPeriod(),
    getActivityDataForPeriod(),
    getActivityCalendarData(),

  ]);
  const activityCalendarDataKeys = Object.keys(activityCalendarData);
  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-4 @3xl/main:col-span-3">
        <div className="@container grid grid-cols-1 auto-rows-max items-start gap-2 md:gap-2">
          <div className="grid min-w-0 gap-4 @3xl/main:grid-cols-2">
            <JobsApplied />
            <JobsActivityCard
              data={[
                { label: "7d", summary: summary7Days },
                { label: "30d", summary: summary30Days },
              ]}
            />
          </div>
          <WeeklyBarChartToggle
            charts={[
              {
                label: "Jobs",
                data: weeklyData,
                keys: ["value"],
                axisLeftLegend: "JOBS APPLIED",
              },
              {
                label: "Activities",
                data: activitiesData.data,
                keys: activitiesData.keys,
                groupMode: "stacked",
                axisLeftLegend: "TIME SPENT (Hours)",
              },
            ]}
          />
        </div>
        <div className="w-full">
          <ActivityCalendar
            years={activityCalendarDataKeys}
            dataByYear={activityCalendarData}
          />
        </div>
      </div>
      <div className="w-full col-span-3">
        <RecentCardToggle jobs={recentJobs} activities={recentActivities} />
      </div>
    </>
  );
}

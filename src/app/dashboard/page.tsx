import { getActivityCalendarData, getJobsForPeriod, getJobsSummary, getRecentJobs } from "@/actions/dashboard.actions";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import JobsCountCard from "@/components/dashboard/JobsCountCard";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import RecentJobsCard from "@/components/dashboard/RecentJobsCard";
import WeeklyJobsChart from "@/components/dashboard/WeeklyJobsChart";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const [summary7Days, summary30Days, recentJobs, weeklyData, calendar] = await Promise.all([
    getJobsSummary(7), getJobsSummary(30), getRecentJobs(), getJobsForPeriod(), getActivityCalendarData(),
  ]);
  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-4 @3xl/main:col-span-3">
        <div className="grid min-w-0 gap-4 @3xl/main:grid-cols-2">
          <JobsApplied />
          <JobsCountCard data={[{ label: "7d", summary: summary7Days }, { label: "30d", summary: summary30Days }]} />
        </div>
        <WeeklyJobsChart data={weeklyData} />
        <ActivityCalendar years={Object.keys(calendar)} dataByYear={calendar} />
      </div>
      <div className="w-full col-span-3"><RecentJobsCard jobs={recentJobs} /></div>
    </>
  );
}

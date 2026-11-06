import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsCountCard from "@/components/dashboard/JobsCountCard";
import WeeklyJobsChart from "@/components/dashboard/WeeklyJobsChart";
import RecentJobsCard from "@/components/dashboard/RecentJobsCard";
import { applicationLevel } from "@/components/dashboard/applicationCalendar";

const { chart } = vi.hoisted(() => ({ chart: vi.fn(() => <div data-testid="weekly-chart" />) }));
vi.mock("@nivo/bar", () => ({ ResponsiveBar: chart }));

describe("Jobs dashboard", () => {
  beforeEach(() => { localStorage.clear(); chart.mockClear(); });

  it("shows job counts for each period without hours or Activity controls", async () => {
    render(<JobsCountCard data={[
      { label: "7d", summary: { jobsApplied: 1, jobsTrend: 0 } },
      { label: "30d", summary: { jobsApplied: 12, jobsTrend: 50 } },
    ]} />);
    expect(screen.getByText("job")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("jobs")).toBeInTheDocument();
    expect(screen.queryByText(/\d+h\b|activities/i)).not.toBeInTheDocument();
  });

  it("uses integer ticks even when only one application is recorded", () => {
    render(<WeeklyJobsChart data={[{ day: "Mon, Nov 2", value: 1 }]} />);
    const props = (chart.mock.calls[0] as unknown as [any])[0];
    expect(props.axisLeft.tickValues).toEqual([0, 1]);
    expect(props.valueScale).toEqual({ type: "linear", min: 0, max: 1 });
    expect(props.valueFormat(1)).toBe("1");
    expect(screen.queryByRole("button", { name: "Activities" })).not.toBeInTheDocument();
  });

  it("has a stable count scale, independent of the year's maximum", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 30].map(applicationLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("renders an empty recent Jobs card without an Activity tab", () => {
    render(<RecentJobsCard jobs={[]} />);
    expect(screen.getByText("Recent Jobs")).toBeInTheDocument();
    expect(screen.getByText("No applications recorded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@nivo/calendar", () => ({
  ResponsiveCalendar: (props: any) => (
    <div data-testid="calendar">
      {props.data.map((d: any) => (
        <div key={d.day} data-testid={`day-${d.day}`}>
          {props.tooltip(d)}
        </div>
      ))}
    </div>
  ),
}));

describe("ActivityCalendar", () => {
  const user = userEvent.setup();

  const dataByYear = {
    "2025": [{ day: "2025-03-01", value: 1 }],
    "2026": [{ day: "2026-06-15", value: 2 }],
  };
  const years = ["2025", "2026"];

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();

  it("defaults to the most recent year and shows its data", () => {
    render(<ActivityCalendar years={years} dataByYear={dataByYear} />);

    expect(screen.getByText("Activity Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Select year")).toHaveTextContent("2026");
    expect(screen.getByTestId("day-2026-06-15")).toBeInTheDocument();
    expect(screen.queryByTestId("day-2025-03-01")).not.toBeInTheDocument();
  });

  it("lists every year as a select option", async () => {
    render(<ActivityCalendar years={years} dataByYear={dataByYear} />);

    await user.click(screen.getByLabelText("Select year"));

    expect(screen.getByRole("option", { name: "2025" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026" })).toBeInTheDocument();
  });

  it("switches the calendar data when a different year is selected", async () => {
    render(<ActivityCalendar years={years} dataByYear={dataByYear} />);

    await user.click(screen.getByLabelText("Select year"));
    await user.click(screen.getByRole("option", { name: "2025" }));

    expect(screen.getByLabelText("Select year")).toHaveTextContent("2025");
    expect(screen.getByTestId("day-2025-03-01")).toBeInTheDocument();
    expect(screen.queryByTestId("day-2026-06-15")).not.toBeInTheDocument();
  });

  it("shows exact integer job counts without activity hours", () => {
    render(
      <ActivityCalendar
        years={["2026"]}
        dataByYear={{
          "2026": [
            { day: "2026-01-01", value: 1 },
            { day: "2026-01-02", value: 2 },
          ],
        }}
      />,
    );

    expect(screen.getByText("1 job applied")).toBeInTheDocument();
    expect(screen.getByText("2 jobs applied")).toBeInTheDocument();
    expect(screen.queryByText(/hrs? activity/)).not.toBeInTheDocument();
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Activity Calendar days" })).toHaveAttribute("tabIndex", "0");
  });

  it("shows the actual count in tooltips rather than its color level", () => {
    render(<ActivityCalendar years={["2026"]} dataByYear={{ "2026": [{ day: "2026-11-01", value: 12 }] }} />);
    expect(screen.getByText("12 jobs applied")).toBeInTheDocument();
    expect(screen.queryByText("4 jobs applied")).not.toBeInTheDocument();
  });

  it("renders a valid current year when there are no applications", () => {
    render(<ActivityCalendar years={[]} dataByYear={{}} />);
    expect(screen.getByLabelText("Select year")).toHaveTextContent(String(new Date().getFullYear()));
    expect(screen.getByLabelText("Applications per day: 0, 1, 2–3, 4–5, 6 or more")).toBeInTheDocument();
  });
});

"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ResponsiveCalendar } from "@nivo/calendar";
import { format, parseISO } from "date-fns";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { APPLICATION_BANDS, APPLICATION_COLORS, applicationLevel } from "./applicationCalendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// The calendar scrolls locally. Render hover content outside that scrollport
// so first/last-week tooltips remain readable at any horizontal position.
function CalendarTooltip({ position, children }: { position: { x: number; y: number }; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setLocation({
      left: Math.max(8, Math.min(position.x - box.width / 2, window.innerWidth - box.width - 8)),
      top: Math.max(8, Math.min(position.y - box.height - 14, window.innerHeight - box.height - 8)),
    });
  }, [position]);
  return createPortal(<div ref={ref} role="tooltip" style={{
    position: "fixed", zIndex: 50, pointerEvents: "none", ...location,
    visibility: location ? "visible" : "hidden", background: "#1e293b", color: "#fff",
    padding: "6px 12px", borderRadius: "4px", fontSize: "12px", whiteSpace: "nowrap",
  }}>{children}</div>, document.body);
}
// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
// website examples showcase many properties,
// you'll often use just a few of them.
export default function ActivityCalendar({
  years,
  dataByYear,
}: {
  years: string[];
  dataByYear: Record<string, { day: string; value: number }[]>;
}) {
  const { resolvedTheme } = useTheme();
  const availableYears = years.length ? [...years].sort() : [String(new Date().getFullYear())];
  const [selectedYear, setYear] = useState(availableYears.at(-1)!);
  const year = availableYears.includes(selectedYear) ? selectedYear : availableYears.at(-1)!;
  const tooltipPosition = useRef({ x: 0, y: 0 });
  const borderColor = resolvedTheme === "light" ? "#ffffff" : "#0e1117";
  const data = dataByYear[year ?? ""] ?? [];
  const counts = new Map(data.map((d) => [d.day, d.value]));
  const emptyColor = resolvedTheme === "light" ? "#eeeeee" : "#30363d";
  const calendarData = data.filter((d) => d.value > 0).map((d) => ({ ...d, value: applicationLevel(d.value) }));
  return (
    <Card className="w-[100%]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-green-600">Activity Calendar</CardTitle>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]" aria-label="Select year">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="max-w-full overflow-x-auto pb-3" role="region" aria-label="Activity Calendar days" tabIndex={0}>
        <div className="h-[260px] min-w-[760px]">
        <ResponsiveCalendar
          data={calendarData}
          from={`${year}-01-01`}
          to={`${year}-12-31`}
          emptyColor={emptyColor}
          colors={APPLICATION_COLORS}
          minValue={1}
          maxValue={4}
          margin={{ top: 64, right: 0, bottom: 40, left: 0 }}
          yearSpacing={40}
          monthBorderColor={borderColor}
          dayBorderWidth={2}
          dayBorderColor={borderColor}
          onMouseEnter={(_day, event) => { tooltipPosition.current = { x: event.clientX, y: event.clientY }; }}
          onMouseMove={(_day, event) => { tooltipPosition.current = { x: event.clientX, y: event.clientY }; }}
          tooltip={(day) => {
            const count = counts.get(day.day) ?? 0;
            return (
              <CalendarTooltip position={tooltipPosition.current}>
                <div><strong>{format(parseISO(day.day), "EEE MMM d, yyyy")}</strong></div>
                <div>{count} job{count === 1 ? "" : "s"} applied</div>
              </CalendarTooltip>
            );
          }}
          theme={{
            text: {
              fill: "#9ca3af",
            },
            tooltip: {
              container: {
                background: "#1e293b",
                color: "#fff",
              },
            },
          }}
          legends={[]}
        />
        </div>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground" aria-label="Applications per day: 0, 1, 2–3, 4–5, 6 or more">
          <span>Less</span>
          {[null, ...APPLICATION_COLORS].map((color, index) => <span key={index} title={index === 0 ? "0 applications" : APPLICATION_BANDS[index - 1]} className={`h-3 w-3 rounded-sm${index === 0 ? " bg-[#eeeeee] dark:bg-[#30363d]" : ""}`} style={color ? { backgroundColor: color } : undefined} />)}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

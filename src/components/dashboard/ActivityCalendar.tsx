"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ResponsiveCalendar } from "@nivo/calendar";
import { format, parseISO } from "date-fns";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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
  dataByYear: Record<string, any[]>;
}) {
  const { resolvedTheme } = useTheme();
  const [year, setYear] = useState(years.at(-1));
  const tooltipPosition = useRef({ x: 0, y: 0 });
  const borderColor = resolvedTheme === "light" ? "#ffffff" : "#0e1117";
  const data = dataByYear[year ?? ""] ?? [];
  const hoursMap = Object.fromEntries(
    data.map((d) => [d.day, d.hours ?? 0]),
  );
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
              {years.map((y) => (
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
          data={data}
          from={`${year}-04-02`}
          to={`${year}-04-02`}
          emptyColor={resolvedTheme === "light" ? "#eeeeee" : "#30363d"}
          colors={["#90e0ef", "#48cae4", "#00b4d8", "#0096c7", "#0077b6"]}
          minValue={2}
          margin={{ top: 64, right: 0, bottom: 40, left: 0 }}
          yearSpacing={40}
          monthBorderColor={borderColor}
          dayBorderWidth={2}
          dayBorderColor={borderColor}
          onMouseEnter={(_day, event) => { tooltipPosition.current = { x: event.clientX, y: event.clientY }; }}
          onMouseMove={(_day, event) => { tooltipPosition.current = { x: event.clientX, y: event.clientY }; }}
          tooltip={(day) => {
            const hours = hoursMap[day.day] ?? 0;
            return (
              <CalendarTooltip position={tooltipPosition.current}>
                <div><strong>{format(parseISO(day.day), "EEE MMM d, yyyy")}</strong></div>
                <div>{day.value} job{Number(day.value) === 1 ? "" : "s"} applied</div>
                <div>{hours} hr{hours === 1 ? "" : "s"} activity</div>
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
          legends={[
            {
              anchor: "bottom-right",
              direction: "row",
              // Legends use the full SVG height inside the translated plot.
              translateY: -64,
              itemCount: 4,
              itemWidth: 42,
              itemHeight: 36,
              itemsSpacing: 14,
              itemDirection: "right-to-left",
            },
          ]}
        />
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

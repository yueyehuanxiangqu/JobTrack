"use client";

import { ResponsiveBar } from "@nivo/bar";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export default function WeeklyJobsChart({ data }: { data: { day: string; value: number }[] }) {
  const maximum = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(maximum / 5));
  const ticks = Array.from({ length: Math.floor(maximum / step) + 1 }, (_, i) => i * step);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg text-green-600">Weekly Jobs</CardTitle></CardHeader>
      <CardContent className="h-[240px] p-3 pt-1">
        <ResponsiveBar
          data={data} keys={["value"]} indexBy="day" valueScale={{ type: "linear", min: 0, max: maximum }}
          margin={{ top: 20, right: 10, bottom: 40, left: 45 }} padding={0.6}
          colors="#2a7ef0" valueFormat={(value) => value.toFixed(0)}
          theme={{ text: { fill: "#9ca3af" }, tooltip: { container: { background: "#1e293b", color: "#fff" } } }}
          axisTop={null} axisRight={null} enableGridX={false} enableGridY={false}
          labelSkipHeight={1} labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
          axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0, format: (value) => String(value).split(", ")[1] ?? String(value) }}
          axisLeft={{ tickSize: 5, tickPadding: 5, tickValues: ticks, legend: "JOBS APPLIED", legendPosition: "middle", legendOffset: -40 }}
          tooltip={({ value, indexValue }) => <div className="rounded bg-slate-800 px-3 py-2 text-sm text-white">{indexValue}: {value} {value === 1 ? "job" : "jobs"} applied</div>}
        />
      </CardContent>
    </Card>
  );
}

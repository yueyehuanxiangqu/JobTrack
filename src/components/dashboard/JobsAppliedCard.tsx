"use client";
import { Button } from "@/components/ui/button";
import {
Card,
CardDescription,
CardFooter,
CardHeader,
CardTitle,
} from "@/components/ui/card";
import {
BriefcaseBusiness,
CalendarClock,
SquareCheckBig
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function JobsAppliedCard() {
  const router = useRouter();
  return (
    <Card className="min-w-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-green-600">Dashboard</CardTitle>
        <CardDescription className="max-w-lg text-balance leading-relaxed">
          Record job applications, organize tasks, and track your activities.
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/myjobs?add-job=true")}
        >
          <BriefcaseBusiness className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0">Add Job</span>
        </Button>

        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/tasks?add-task=true")}
        >
          <SquareCheckBig className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0">Add Task</span>
        </Button>

        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/activities?add-activity=true")
          }
        >
          <CalendarClock className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0">Add Activity</span>
        </Button>

      </CardFooter>
    </Card>
  );
}

import { redirect } from "next/navigation";

// Old bookmarks open the remaining planning tool; no Activity UI or timer is loaded.
export default function RetiredActivities() {
  redirect("/dashboard/tasks");
}

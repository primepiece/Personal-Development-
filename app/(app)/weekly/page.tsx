import { redirect } from "next/navigation";
import { weekStartKey } from "@/lib/weekly/date";

export default function WeeklyRedirect() {
  redirect(`/weekly/${weekStartKey(new Date())}`);
}

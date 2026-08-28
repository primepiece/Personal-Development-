import { redirect } from "next/navigation";
import { weekStartKey } from "@/lib/weekly/date";

export default function CoachRedirect() {
  redirect(`/coach/${weekStartKey(new Date())}`);
}

import { redirect } from "next/navigation";

// Redirect /plans to dashboard for now
export default function PlansPage() {
  redirect("/dashboard");
}

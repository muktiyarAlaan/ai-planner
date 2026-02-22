import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

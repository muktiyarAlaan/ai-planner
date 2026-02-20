import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SessionProvider } from "@/components/session-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // If user has no API key and is not on onboarding, redirect there
  // (onboarding page itself doesn't need the key)

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 ml-56 min-h-screen">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/components/auth-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = {
    id: session.id,
    email: session.email,
    name: session.name,
    image: session.image,
    claudeApiKey: session.claudeApiKey,
    hasLinearToken: session.hasLinearToken,
    hasGithubToken: session.hasGithubToken,
    githubRepos: session.githubRepos,
    agentContextEnabled: session.agentContextEnabled,
  };

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-screen bg-[#f5f6fa]">
        <Sidebar />
        <main className="flex-1 ml-56 min-h-screen">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}

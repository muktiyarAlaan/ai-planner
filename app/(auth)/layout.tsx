import { SessionProvider } from "@/components/session-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider session={null}>{children}</SessionProvider>;
}

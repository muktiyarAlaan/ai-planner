import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      claudeApiKey?: string | null;
      linearAccessToken?: string | null;
    };
  }

  interface User {
    id: string;
    claudeApiKey?: string | null;
    linearAccessToken?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    claudeApiKey?: string | null;
    linearAccessToken?: string | null;
  }
}

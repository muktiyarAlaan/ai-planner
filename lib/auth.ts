import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        await sequelize.authenticate();

        // Upsert user on sign-in
        const [dbUser] = await User.findOrCreate({
          where: { email: user.email },
          defaults: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          },
        });

        // Update name/image if they changed
        if (dbUser.name !== user.name || dbUser.image !== user.image) {
          await dbUser.update({
            name: user.name ?? null,
            image: user.image ?? null,
          });
        }

        // Attach DB id to user object for JWT
        user.id = dbUser.id;
        user.claudeApiKey = dbUser.claudeApiKey;
        user.linearAccessToken = dbUser.linearAccessToken;

        return true;
      } catch (error) {
        console.error("SignIn error:", error);
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.claudeApiKey = user.claudeApiKey ?? null;
        token.linearAccessToken = user.linearAccessToken ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId;
        session.user.claudeApiKey = token.claudeApiKey ?? null;
        session.user.linearAccessToken = token.linearAccessToken ?? null;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // After sign-in, let the app layout handle the redirect logic
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  claudeApiKey: string | null;
  hasLinearToken: boolean;
  hasGithubToken: boolean;
  githubRepos: { fullName: string; owner: string; repo: string }[] | null;
  agentContextEnabled: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface Props {
  user: AuthUser | null;
  children: React.ReactNode;
}

export function AuthProvider({ user, children }: Props) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(user);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // If the DB image is null, pull the photo URL directly from Firebase client state
  // so the avatar shows immediately without requiring a re-login.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.photoURL) {
        setCurrentUser((prev) =>
          prev ? { ...prev, image: prev.image || firebaseUser.photoURL } : prev
        );
      }
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user: currentUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

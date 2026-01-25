import { createAuthClient } from "better-auth/client";

// Use API URL from env (localhost for dev, production URL for prod)
const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8787";
export const authClient = createAuthClient({
  baseURL: `${apiBase}/api/auth`,
});

// Helper for Google Sign In
export const signInWithGoogle = async () => {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}${import.meta.env.BASE_URL}`, // Redirect back to app with correct base path
  });
};

export const signOut = async () => {
  await authClient.signOut();
  window.location.reload();
};

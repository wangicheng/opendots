import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { openAPI } from "better-auth/plugins";

import * as schema from "./db/schema";

export const auth = (env: Env) => {
  const db = drizzle(env.DB, { schema });
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema
      }
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [
      openAPI(),
    ],
    trustedOrigins: ["http://localhost:5173", "https://opendots.pages.dev", "https://wangicheng.github.io"],
    secret: env.BETTER_AUTH_SECRET,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
      crossSubDomainCookies: {
        enabled: true
      }
    }
  });
};

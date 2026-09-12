import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // ------------------------------------------------------------
  // SESSION CONFIGURATION
  // ------------------------------------------------------------

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  // ------------------------------------------------------------
  // AUTHENTICATION PAGES
  // ------------------------------------------------------------

  pages: {
    signIn: "/login",
  },

  // ------------------------------------------------------------
  // CREDENTIALS PROVIDER
  // ------------------------------------------------------------

  providers: [
    Credentials({
      name: "Credentials",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials, request) {
        // --------------------------------------------------------
        // VALIDATE LOGIN INPUT
        // --------------------------------------------------------

        if (
          !credentials?.email ||
          !credentials?.password
        ) {
          return null;
        }

        const email = String(credentials.email)
          .trim()
          .toLowerCase();

        const password = String(credentials.password);

        // --------------------------------------------------------
        // FIND USER
        // --------------------------------------------------------

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        });

        // Do not reveal whether the email exists.
        if (!user) {
          return null;
        }

        // --------------------------------------------------------
        // ONLY ACTIVE USERS MAY LOG IN
        // --------------------------------------------------------

        if (user.status !== "ACTIVE") {
          return null;
        }

        // --------------------------------------------------------
        // USER MUST HAVE A PASSWORD HASH
        // --------------------------------------------------------

        if (!user.passwordHash) {
          return null;
        }

        // --------------------------------------------------------
        // VERIFY PASSWORD
        // --------------------------------------------------------

        const passwordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!passwordValid) {
          return null;
        }

        // --------------------------------------------------------
        // UPDATE LAST LOGIN
        // --------------------------------------------------------

        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            lastLoginAt: new Date(),
          },
        });

        // --------------------------------------------------------
        // AUDIT SUCCESSFUL LOGIN
        // --------------------------------------------------------

        await createAuditLog({
          request,
          firmId: user.firmId,
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,

          description:
            `User ${user.name} (${user.email}) logged in successfully.`,

          metadata: {
            role: user.role,
            loginMethod: "Credentials",
          },
        });

        // --------------------------------------------------------
        // RETURN AUTHENTICATED USER
        // --------------------------------------------------------

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firmId: user.firmId,
        };
      },
    }),
  ],

  // ------------------------------------------------------------
  // CALLBACKS
  // ------------------------------------------------------------

  callbacks: {
    // ----------------------------------------------------------
    // JWT CALLBACK
    // ----------------------------------------------------------

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firmId = user.firmId;
      }

      return token;
    },

    // ----------------------------------------------------------
    // SESSION CALLBACK
    // ----------------------------------------------------------

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firmId = token.firmId as string;
      }

      return session;
    },
  },

  // ------------------------------------------------------------
  // AUTHENTICATION EVENTS
  // ------------------------------------------------------------

  events: {
    async signOut(message) {
      const token =
        "token" in message
          ? message.token
          : null;

      const userId =
        token && typeof token.id === "string"
          ? token.id
          : null;

      const firmId =
        token && typeof token.firmId === "string"
          ? token.firmId
          : null;

      // --------------------------------------------------------
      // AUDIT LOG
      // --------------------------------------------------------

      if (userId && firmId) {
        await createAuditLog({
          firmId,
          userId,
          action: "LOGOUT",
          entityType: "User",
          entityId: userId,

          description:
            "User logged out.",

          metadata: {
            logoutMethod: "NextAuth",
          },
        });
      }
    },
  },
});
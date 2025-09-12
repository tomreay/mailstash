import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from './db';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

export const { handlers, signIn, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: SCOPES.join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async linkAccount({ user, account }) {
      // This event fires when an account is linked to a user (including first sign in)
      if (
        account.provider === 'google' &&
        account.access_token &&
        user.email &&
        user.id
      ) {
        try {
          console.log(
            `Creating/updating emailAccount for ${user.email} after account link`
          );
          await db.emailAccount.upsert({
            where: {
              email: user.email,
            },
            update: {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              gmailId: account.providerAccountId,
              userId: user.id,
            },
            create: {
              email: user.email,
              displayName: user.name || undefined,
              provider: 'gmail',
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              gmailId: account.providerAccountId,
              userId: user.id,
            },
          });
        } catch (error) {
          console.error('Error creating/updating email account:', error);
        }
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

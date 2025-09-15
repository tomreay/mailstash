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
      // This event only fires on FIRST sign in when linking account to user
      // It's used for initial setup only, not for adding additional email accounts
      if (
        account.provider === 'google' &&
        account.access_token &&
        user.email &&
        user.id
      ) {
        try {
          // Only create the initial EmailAccount for first-time sign up
          const existingAccounts = await db.emailAccount.count({
            where: { userId: user.id }
          });

          // Only create if this is the user's first email account
          if (existingAccounts === 0) {
            console.log(
              `Creating initial EmailAccount for user ${user.email} on first sign in`
            );

            await db.emailAccount.create({
              data: {
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
          }
        } catch (error) {
          console.error('Error creating initial email account:', error);
        }
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  // Use NEXTAUTH_URL for the base URL in production
  const baseUrl = process.env.NEXTAUTH_URL || request.url;

  // Check if user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', baseUrl));
  }

  if (action === 'connect') {
    // Step 1: Redirect to Google OAuth
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/gmail?action=callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'select_account consent', // Force account selection
      state: session.user.id, // Pass user ID in state
    });

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  }

  if (action === 'callback') {
    // Step 2: Handle OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the user ID
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/accounts?error=oauth_failed', baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/accounts?error=invalid_callback', baseUrl));
    }

    // Verify the state matches the current user
    if (state !== session.user.id) {
      console.error('State mismatch - possible CSRF attack');
      return NextResponse.redirect(new URL('/accounts?error=state_mismatch', baseUrl));
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/gmail?action=callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        return NextResponse.redirect(new URL('/accounts?error=token_exchange_failed', baseUrl));
      }

      const tokens = await tokenResponse.json();

      // Get user info to get the Gmail account details
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to get user info');
        return NextResponse.redirect(new URL('/accounts?error=userinfo_failed', baseUrl));
      }

      const googleUser = await userInfoResponse.json();

      console.log(`Adding Gmail account: ${googleUser.email} (gmailId: ${googleUser.id}) for user: ${session.user.id}`);

      // Create or update the EmailAccount
      await db.emailAccount.upsert({
        where: {
          gmailId: googleUser.id,
        },
        update: {
          email: googleUser.email,
          displayName: googleUser.name || undefined,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          userId: session.user.id,
        },
        create: {
          email: googleUser.email,
          displayName: googleUser.name || undefined,
          provider: 'gmail',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          gmailId: googleUser.id,
          userId: session.user.id,
        },
      });

      console.log(`Successfully added Gmail account ${googleUser.email}`);

      return NextResponse.redirect(new URL('/accounts?success=gmail_connected', baseUrl));
    } catch (error) {
      console.error('Error in Gmail OAuth callback:', error);
      return NextResponse.redirect(new URL('/accounts?error=oauth_error', baseUrl));
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
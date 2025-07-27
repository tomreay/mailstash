import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  async function handleGoogleSignIn() {
    'use server'
    await signIn('google', { redirectTo: params.callbackUrl || '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Sign in to MailStash</CardTitle>
          <CardDescription>
            Connect your email accounts to start organizing your inbox
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error === 'Callback' && 'Authentication failed. Please try again.'}
              {error === 'OAuthSignin' && 'Error constructing authorization URL'}
              {error === 'OAuthCallback' && 'Error handling the response from OAuth provider'}
              {error === 'OAuthCreateAccount' && 'Could not create OAuth provider user'}
              {error === 'EmailCreateAccount' && 'Could not create email provider user'}
              {error === 'OAuthAccountNotLinked' && 'Email already in use with different provider'}
              {error === 'EmailSignin' && 'Check your email for the magic link'}
              {error === 'CredentialsSignin' && 'Sign in failed. Check the details you provided are correct'}
              {error === 'SessionRequired' && 'Please sign in to access this page'}
              {error === 'Default' && 'Unable to sign in'}
            </div>
          )}
          <form action={handleGoogleSignIn}>
            <Button
              type="submit"
              className="w-full"
              size="lg"
            >
              <svg
                className="mr-2 h-4 w-4"
                aria-hidden="true"
                focusable="false"
                data-prefix="fab"
                data-icon="google"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                ></path>
              </svg>
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AccountsService } from '@/lib/services/accounts.service'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accounts = await AccountsService.getUserAccountsWithStats(session.user.id)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const account = await AccountsService.createAccount(session.user.id, body)
    
    return NextResponse.json(account)
  } catch (error) {
    console.error('Error creating account:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Provider and email are required') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message === 'Account with this email already exists') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
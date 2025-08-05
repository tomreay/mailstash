import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AccountsService } from '@/lib/services/accounts.service'
import { toClientSettings } from '@/lib/types/account-settings'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await AccountsService.getAccountDetails(id, session.user.id)
    
    // Convert settings dates to strings for client
    const clientAccount = {
      ...account,
      settings: account.settings ? toClientSettings(account.settings) : null
    }
    
    return NextResponse.json({ account: clientAccount })
  } catch (error) {
    console.error('Error fetching account:', error)
    
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify account belongs to user before deleting
    await AccountsService.validateUserAccess(id, session.user.id)
    
    // Delete account (cascading deletes will handle related data)
    await AccountsService.deleteAccount(id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    
    if (error instanceof Error && error.message === 'Account not found or access denied') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
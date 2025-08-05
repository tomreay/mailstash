import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { EmailsService } from '@/lib/services/emails.service'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const accountId = searchParams.get('accountId') || undefined

    const response = await EmailsService.getUserEmails(session.user.id, {
      page,
      limit,
      search,
      accountId,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
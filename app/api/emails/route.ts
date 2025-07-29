import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailsResponse, EmailListItem } from '@/types'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    // Get user's email account
    const account = await db.emailAccount.findUnique({
      where: { email: session.user.email },
    })

    if (!account) {
      return NextResponse.json({ 
        emails: [],
        total: 0,
        page,
        limit 
      })
    }

    // Build query conditions
    const where = {
      accountId: account.id,
      isDeleted: false,
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' as const } },
          { from: { contains: search, mode: 'insensitive' as const } },
          { textContent: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    // Get emails with pagination
    const [emails, total] = await Promise.all([
      db.email.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          messageId: true,
          subject: true,
          from: true,
          to: true,
          date: true,
          isRead: true,
          isImportant: true,
          hasAttachments: true,
          labels: true,
          textContent: true,
        },
      }),
      db.email.count({ where }),
    ])

    // Parse labels and create snippets
    const formattedEmails: EmailListItem[] = emails.map(email => ({
      ...email,
      date: email.date.toISOString(),
      labels: email.labels ? JSON.parse(email.labels) : [],
      snippet: email.textContent ? email.textContent.substring(0, 200) + '...' : '',
    }))

    const response: EmailsResponse = {
      emails: formattedEmails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
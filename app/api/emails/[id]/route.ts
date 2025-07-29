import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailDetail } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email account
    const account = await db.emailAccount.findUnique({
      where: { email: session.user.email },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Get the email
    const email = await db.email.findFirst({
      where: {
        id: params.id,
        accountId: account.id,
        isDeleted: false,
      },
      include: {
        attachments: true,
        folder: true,
      },
    })

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Mark as read if not already
    if (!email.isRead) {
      await db.email.update({
        where: { id: email.id },
        data: { isRead: true },
      })
    }

    // Parse labels and format response
    const formattedEmail: EmailDetail = {
      ...email,
      date: email.date.toISOString(),
      createdAt: email.createdAt.toISOString() as any,
      updatedAt: email.updatedAt.toISOString() as any,
      labels: email.labels ? JSON.parse(email.labels) : [],
      attachments: email.attachments.map(att => ({
        ...att,
        createdAt: att.createdAt.toISOString() as any,
        updatedAt: att.updatedAt.toISOString() as any,
      })),
      folder: email.folder ? {
        ...email.folder,
        createdAt: email.folder.createdAt.toISOString() as any,
        updatedAt: email.folder.updatedAt.toISOString() as any,
      } : null,
    }

    return NextResponse.json(formattedEmail)
  } catch (error) {
    console.error('Error fetching email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
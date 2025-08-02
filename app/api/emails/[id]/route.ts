import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailDetail } from '@/types'
import { parseEmlContent } from '@/lib/utils/eml-parser'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await params before accessing its properties
    const { id } = await params

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
        id,
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

    // Parse email content from EML file
    let textContent: string | undefined
    let htmlContent: string | undefined
    
    if (email.emlPath) {
      try {
        const content = await parseEmlContent(email.emlPath)
        textContent = content.textContent
        htmlContent = content.htmlContent
      } catch (error) {
        console.error('Error parsing EML file:', error)
      }
    }

    // Parse labels and format response
    const formattedEmail: EmailDetail = {
      ...email,
      textContent,
      htmlContent,
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
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { EmailsService } from '@/lib/services/emails.service'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await params before accessing its properties
    const { id } = await params

    const email = await EmailsService.getEmailDetails(id, session.user.id)
    return NextResponse.json(email)
  } catch (error) {
    console.error('Error fetching email:', error)
    
    if (error instanceof Error) {
      if (error.message === 'No active accounts found' || error.message === 'Email not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
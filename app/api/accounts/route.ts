import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AccountsService } from '@/lib/services/accounts.service'
import { scheduleMboxImport } from '@/lib/jobs/queue'
import { db } from '@/lib/db'
import path from 'path'
import { promises as fs } from 'fs'

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle JSON account creation
    const body = await request.json()
    
    // Check if this is an archive account with mbox file
    if (body.provider === 'archive' && body.mboxFilePath) {
      // Resolve the file path
      let resolvedPath = body.mboxFilePath
      
      // Handle TUS upload references
      if (body.mboxFilePath.startsWith('tus:')) {
        const uploadId = body.mboxFilePath.substring(4) // Remove 'tus:' prefix
        
        // The TUS server generates filenames like: 1754835968935-wurqpa.mbox
        // The uploadId from the URL should match this pattern
        console.log('Upload ID from request:', uploadId)
        
        // Check if uploadId already includes .mbox extension
        if (!uploadId.endsWith('.mbox')) {
          resolvedPath = path.join(process.cwd(), 'tmp', 'mbox-uploads', uploadId + '.mbox')
        } else {
          resolvedPath = path.join(process.cwd(), 'tmp', 'mbox-uploads', uploadId)
        }
        
        console.log('Resolved TUS upload path:', resolvedPath)
        
        // Check if file exists
        const fileExists = await fs.access(resolvedPath).then(() => true).catch(() => false)
        console.log('File exists at resolved path:', fileExists)
        
        if (!fileExists) {
          // List files in directory for debugging
          const uploadDir = path.join(process.cwd(), 'tmp', 'mbox-uploads')
          try {
            const files = await fs.readdir(uploadDir)
            console.log('Files in upload directory:', files)
            console.log('Looking for file matching uploadId:', uploadId)
          } catch (err) {
            console.error('Could not list upload directory:', err)
          }
          
          throw new Error(`Upload file not found: ${uploadId}`)
        }
      }
      
      // Create archive account
      const account = await AccountsService.createAccount(session.user.id, {
        provider: 'archive',
        email: body.email,
        displayName: body.displayName || body.email
      })
      
      // Schedule mbox import job
      const job = await scheduleMboxImport(account.id, resolvedPath)
      
      // Fetch the complete account with sync status
      const accountWithStatus = await db.emailAccount.findUnique({
        where: { id: account.id },
        include: {
          syncStatus: true
        }
      })
      
      return NextResponse.json({
        ...accountWithStatus,
        importJobId: job.id,
        // Ensure syncStatus is returned as a string for compatibility
        syncStatus: accountWithStatus?.syncStatus?.syncStatus || 'syncing',
        lastSyncAt: accountWithStatus?.syncStatus?.lastSyncAt || null
      })
    }
    
    // Handle regular account creation (Gmail, IMAP)
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
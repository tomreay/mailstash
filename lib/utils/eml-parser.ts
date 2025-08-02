import { simpleParser, ParsedMail } from 'mailparser'
import { promises as fs } from 'fs'

export interface EmailContent {
  textContent?: string
  htmlContent?: string
}

export async function parseEmlContent(emlPath: string): Promise<EmailContent> {
  try {
    // Read the EML file
    const emlContent = await fs.readFile(emlPath, 'utf-8')
    
    // Parse the email
    const parsed: ParsedMail = await simpleParser(emlContent)
    
    return {
      textContent: parsed.text || undefined,
      htmlContent: parsed.html || undefined,
    }
  } catch (error) {
    console.error('Error parsing EML file:', error)
    throw new Error('Failed to parse email content')
  }
}
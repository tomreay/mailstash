# MailStash - Email Archiving Tool

MailStash is a modern email archiving solution that automatically downloads, stores, and indexes emails from Gmail and IMAP servers. It provides full-text search, virus scanning, and configurable retention policies.

## Features

- 🔐 **Secure Authentication** - OAuth2 for Gmail, secure credential storage
- 📧 **Multi-Provider Support** - Gmail API and IMAP for other providers
- 🗄️ **Open Storage Format** - EML files for maximum portability
- 🔍 **Full-Text Search** - SQLite FTS5 for fast email search
- 📱 **Modern UI** - Clean, responsive interface built with Next.js and Tailwind CSS
- 🐳 **Docker Ready** - Easy deployment with Docker Compose
- 🔄 **Automatic Sync** - Scheduled email synchronization
- 📊 **Analytics** - Storage usage and email statistics

## Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- Docker and Docker Compose

### Installation

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Set up environment variables**
   Edit `.env` with your configuration:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

3. **Set up the database**
   ```bash
   yarn db:push
   ```

4. **Start the development server**
   ```bash
   yarn dev
   ```

5**Open your browser**
   Navigate to `http://localhost:3000`

## Google OAuth2 Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Create OAuth2 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy the Client ID and Client Secret to your `.env` file

## Docker Deployment

### Self-Hosted Deployment

1. **Build and start all services**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   Navigate to `http://localhost:3000`

## Architecture

### Core Components

- **Next.js App** - Main application with API routes
- **Prisma ORM** - Database management with SQLite
- **NextAuth.js** - Authentication and OAuth2 handling
- **ImapFlow** - IMAP client for email servers
- **Google APIs** - Gmail integration
- **Mailparser** - Email parsing and attachment extraction

### Storage Structure

```
storage/
├── emails/
│   └── {account-id}/
│       ├── {email-id}.eml
│       └── ...
└── attachments/
    └── {account-id}/
        └── {email-id}/
            ├── attachment1.pdf
            └── ...
```

## Development

### Project Structure

```
mailstash/
├── app/                 # Next.js app router
├── components/          # React components
├── lib/                 # Utilities and services
│   ├── email/          # Email processing
│   ├── storage/        # File storage
│   └── security/       # Virus scanning
├── types/              # TypeScript types
├── prisma/             # Database schema
└── storage/            # Email and attachment storage
```

### Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn db:push` - Update database schema
- `yarn db:studio` - Open Prisma Studio
- `yarn lint` - Run ESLint

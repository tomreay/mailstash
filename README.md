# MailStash - Email Archiving Tool

MailStash is a modern email archiving solution that automatically downloads, stores, and indexes emails from Gmail and IMAP servers. It provides full-text search, virus scanning, and configurable retention policies.

## Features

- 🔐 **Secure Authentication** - OAuth2 for Gmail, secure credential storage
- 📧 **Multi-Provider Support** - Gmail API and IMAP for other providers
- 🗄️ **Open Storage Format** - EML files for maximum portability
- 🔍 **Full-Text Search** - PostgreSQL full-text search
- 📱 **Modern UI** - Clean, responsive interface built with Next.js and Tailwind CSS
- 🐳 **Docker Ready** - Production-ready Docker Compose setup
- 🔄 **Background Jobs** - Graphile Worker for reliable email synchronization
- 🗑️ **Auto-Delete** - Configurable retention policies per account
- 📦 **Mbox Import** - Import existing email archives

## Quick Start

### Prerequisites

- Node.js 20+ and Yarn
- PostgreSQL 15+ (or use Docker)
- Docker and Docker Compose (for production)

### Development Setup

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start PostgreSQL** (if not using Docker)
   ```bash
   docker-compose up -d postgres
   ```

4. **Set up the database**
   ```bash
   yarn db:push
   ```

5. **Start the development server**
   ```bash
   yarn dev
   ```

6. **Start the worker** (in another terminal)
   ```bash
   yarn worker
   ```

7. **Open your browser**
   Navigate to `http://localhost:3000`

## Google OAuth2 Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Create OAuth2 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy the Client ID and Client Secret to your `.env` file

## Production Deployment

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mailstash
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   # IMPORTANT: Set strong passwords for POSTGRES_PASSWORD and NEXTAUTH_SECRET
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose --env-file .env -f docker-compose.prod.yml up -d --build
   ```

4. **Access the application**
   Navigate to `http://localhost:3000`

### Building and Publishing Docker Images

To build and push the MailStash images to Docker Hub with multi-platform support:

1. **Setup Docker Buildx** (one-time setup)
   ```bash
   # Create a new builder instance
   docker buildx create --name multibuilder --use

   # Verify it's working
   docker buildx inspect --bootstrap
   ```

2. **Build and push multi-platform images**
   ```bash
   # Login to Docker Hub first
   docker login

   # Build and push the main application image for both AMD64 and ARM64
   docker buildx build --platform linux/amd64,linux/arm64 \
     -f Dockerfile.prod \
     -t gettby/mailstash-app:latest \
     --push .

   # Build and push the worker image for both platforms
   docker buildx build --platform linux/amd64,linux/arm64 \
     -f Dockerfile.worker \
     -t gettby/mailstash-worker:latest \
     --push .
   ```

3. **Tag with version** (optional)
   ```bash
   # Build with version tag (replace X.Y.Z with your version)
   docker buildx build --platform linux/amd64,linux/arm64 \
     -f Dockerfile.prod \
     -t gettby/mailstash-app:latest \
     -t gettby/mailstash-app:X.Y.Z \
     --push .

   docker buildx build --platform linux/amd64,linux/arm64 \
     -f Dockerfile.worker \
     -t gettby/mailstash-worker:latest \
     -t gettby/mailstash-worker:X.Y.Z \
     --push .
   ```

4. **Alternative: Build for single platform only**
   ```bash
   # If you only need AMD64 (most servers)
   docker buildx build --platform linux/amd64 \
     -f Dockerfile.prod \
     -t gettby/mailstash-app:latest \
     --push .

   docker buildx build --platform linux/amd64 \
     -f Dockerfile.worker \
     -t gettby/mailstash-worker:latest \
     --push .
   ```

### Production Architecture

- **PostgreSQL** - Primary database
- **Next.js App** - Main application (standalone build)
- **Graphile Worker** - Background job processing
- **Docker Volumes** - Persistent storage for emails and attachments

## Architecture

### Core Components

- **Next.js 15** - Main application with App Router
- **Prisma ORM** - Database management with PostgreSQL
- **NextAuth.js** - Authentication and OAuth2 handling
- **Graphile Worker** - Reliable background job processing
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

- `yarn dev` - Start development server (with Turbopack)
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn worker` - Start the background worker
- `yarn db:push` - Update database schema
- `yarn db:migrate` - Run database migrations
- `yarn db:studio` - Open Prisma Studio
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for session encryption (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application URL (e.g., `http://localhost:3000`)

### Optional
- `GOOGLE_CLIENT_ID` - For Gmail OAuth integration
- `GOOGLE_CLIENT_SECRET` - For Gmail OAuth integration
- `EMAIL_STORAGE_PATH` - Path for email storage (default: `./storage/emails`)
- `ATTACHMENT_STORAGE_PATH` - Path for attachments (default: `./storage/attachments`)
- `WORKER_CONCURRENCY` - Number of concurrent jobs (default: 5)

## Key Features

### Email Account Management
- Support for Gmail (OAuth) and IMAP accounts
- Per-account sync settings and schedules
- Auto-delete policies with configurable retention periods
- Archive-only mode for read-only email preservation

### Background Jobs
- Full sync for initial email download
- Incremental sync for updates
- Folder-specific synchronization
- Automatic cleanup based on retention policies
- Mbox file import for existing archives

### Storage
- Emails stored as EML files for portability
- Hierarchical folder structure by account
- Separate attachment storage with deduplication
- Configurable storage paths

## Troubleshooting

### Common Issues

**Database Connection**
- Ensure PostgreSQL is running
- Check DATABASE_URL format: `postgresql://user:password@host:5432/database`
- For special characters in passwords, use URL encoding

**Worker Not Processing Jobs**
- Check worker logs: `docker-compose -f docker-compose.prod.yml logs worker`
- Verify Graphile Worker tables exist in database
- Ensure DATABASE_URL is correctly set

**Gmail Authentication**
- Enable Gmail API in Google Cloud Console
- Add redirect URI: `http://localhost:3000/api/auth/callback/google`
- Ensure OAuth consent screen is configured

## License

MIT

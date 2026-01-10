# 🍌 Bananalytics

Lightweight self-hosted crash reporting and analytics platform for Android applications. A simple alternative to Firebase Crashlytics or HockeyApp.

## Features

- **Crash Reporting** — Automatic crash grouping by stacktrace fingerprint
- **R8/ProGuard Deobfuscation** — Upload mapping files to decode stacktraces
- **Event Analytics** — Track custom events with tags and numeric fields
- **Breadcrumbs** — See user actions leading up to a crash
- **Multi-user Access** — Share apps with team members (admin/viewer roles)
- **Version Muting** — Disable crash/event collection for specific versions
- **Self-hosted** — Full control over your data

## Quick Start

### Development

```bash
docker compose up
```

Services:
- **Frontend**: http://localhost:3177
- **Backend API**: http://localhost:8266
- **pgAdmin**: http://localhost:5050 (admin@admin.com / admin)
- **MinIO Console**: http://localhost:9101 (bananalytics / bananalytics_dev)

### Production

```bash
# Create external network
docker network create reverseproxy

# Configure environment
cp env.example .env
# Edit .env with secure values

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | Required |
| `S3_ACCESS_KEY` | MinIO/S3 access key | Required |
| `S3_SECRET_KEY` | MinIO/S3 secret key | Required |
| `S3_BUCKET` | Bucket for mapping files | `bananalytics` |
| `REGISTRATION_ENABLED` | Allow new user registration | `false` (prod) |

## Android SDK Integration

```kotlin
class MyEventSender(private val apiKey: String) : EventSender {
    override fun sendEvents(payload: String): Boolean {
        val request = Request.Builder()
            .url("https://your-server.com/api/v1/events/submit")
            .header("Content-Type", "application/json")
            .header("X-API-Key", apiKey)
            .post(payload.toRequestBody())
            .build()
        // Execute request...
    }
}
```

## API

See full API documentation with request/response contracts: **[docs/API.md](docs/API.md)**

Quick overview:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/events/submit` | API Key | Submit events from SDK |
| `POST /api/v1/crashes/submit` | API Key | Submit crashes from SDK |
| `POST /api/v1/auth/login` | — | Login |
| `GET /api/v1/apps` | Session | List apps |
| `GET /api/v1/apps/{id}/crashes` | Session | Get crash groups |

## Tech Stack

- **Backend**: Kotlin, Ktor, Exposed, PostgreSQL, R8 Retrace
- **Frontend**: React, TypeScript, Ant Design, Vite
- **Infrastructure**: Docker, Docker Compose

## License

Apache 2.0

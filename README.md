# 🍌 Bananalytics

Lightweight crash reporting and analytics backend for Android applications.

## Quick Start

### Development

```bash
# Start all services (PostgreSQL, pgAdmin, Backend, Frontend)
docker compose up

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8080
# - pgAdmin: http://localhost:5050 (admin@admin.com / admin)
```

### Production

```bash
# Create external network (if not exists)
docker network create reverseproxy

# Copy and configure environment
cp env.example .env
# Edit .env with production values

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│ PostgreSQL  │
│ React + Ant │     │ Kotlin/Ktor │     │             │
│   :3000     │     │   :8080     │     │   :5432     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## API Endpoints

### SDK Endpoints (require X-API-Key header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events/submit` | Submit analytics events |
| POST | `/api/v1/crashes/submit` | Submit crash reports |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/apps` | List all apps |
| POST | `/api/v1/apps` | Create new app |
| GET | `/api/v1/apps/{id}` | Get app details |
| GET | `/api/v1/apps/{id}/versions` | List app versions |
| POST | `/api/v1/apps/{id}/versions` | Create version with mapping |
| GET | `/api/v1/apps/{id}/crashes` | Get crash groups |
| GET | `/api/v1/apps/{id}/events` | Get events |
| GET | `/api/v1/crashes/{id}` | Get crash details |
| POST | `/api/v1/crashes/{id}/retrace` | Retrace crash stacktrace |

## SDK Integration

```kotlin
class MyEventSender(private val apiKey: String) : EventSender {
    override fun sendEvents(payload: String): Boolean {
        val request = Request.Builder()
            .url("https://your-server.com/api/v1/events/submit")
            .header("Content-Type", "application/json")
            .header("X-API-Key", apiKey)
            .post(payload.toRequestBody())
            .build()
        // ...
    }
}
```

## Stack

- **Backend**: Kotlin, Ktor, Exposed, PostgreSQL, R8 Retrace
- **Frontend**: React, TypeScript, Ant Design, Vite
- **Infrastructure**: Docker, Docker Compose

## License

Apache 2.0

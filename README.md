# 🍌 Bananalytics

Lightweight self-hosted crash reporting and analytics platform for Android applications. A simple alternative to Firebase Crashlytics or HockeyApp.

<table>
  <tr>
    <td><img src="docs/screenshots/crash-report.jpg" alt="Crash Report" width="400"/></td>
    <td><img src="docs/screenshots/crashes-list.jpg" alt="Crashes List" width="400"/></td>
  </tr>
</table>

## Features

- **Crash Reporting** — Automatic crash grouping by stacktrace fingerprint
- **R8/ProGuard Deobfuscation** — Upload mapping files to decode stacktraces
- **Event Analytics** — Track custom events with tags and numeric fields
- **APK Distribution** — Upload APK builds for testers with release notes
- **One-Call CI Publishing** — Push a build straight from your pipeline; version is read from the APK
- **Breadcrumbs** — See user actions leading up to a crash
- **Session Tracking** — Crash-free sessions and unique session metrics
- **Multi-user Access** — Share apps with team members (admin/viewer/tester roles)
- **Email Invitations** — Invite users by email, even if they're not registered yet
- **Version Muting** — Disable crash/event collection for specific versions
- **MCP Server for AI Agents** — Claude, Cursor, ChatGPT and other agents read crashes and analytics over MCP, signing in with OAuth or a personal access token
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
# Create external network (if not exists)
docker network create reverseproxy

# Configure environment
cp env.example .env
# Edit .env with secure values

# Start services
docker compose -f docker-compose.prod.yml up -d
```

The production setup uses Nginx as a reverse proxy. Only the `bananalytics-nginx` container is exposed to the `reverseproxy` network. Connect your main HTTPS server to proxy requests to it.

PostgreSQL production defaults reserve 2 GB for shared buffers and allow 16 MB
per sort/hash operation. For smaller hosts, override `POSTGRES_SHARED_BUFFERS`,
`POSTGRES_EFFECTIVE_CACHE_SIZE` and `POSTGRES_WORK_MEM` in `.env`.

Migration `015_analytics_rollups` backfills daily event counts. Build the images
first, then stop the backend before applying this migration; leave it stopped
until the new backend starts. Old backend images do not maintain these counters.
The backfill is transactional and does not modify raw events. If reverting to an
old image, rebuild `event_stats_daily` from raw events before upgrading again.

Migration `016_session_covering_index` replaces the session date index with a
covering index. For an online upgrade, create/drop these indexes with
`CONCURRENTLY` outside the migration transaction, then record the migration as
applied. Run `VACUUM (ANALYZE, TRUNCATE FALSE) app_sessions` to refresh the visibility
map after retention; this allows analytics to use index-only scans.

Analytics integration tests require a disposable PostgreSQL 16 database named
`bananalytics_test` (the test suite resets its public schema):

```bash
TEST_DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/bananalytics_test \
TEST_DATABASE_PASSWORD=perf-local gradle -p backend test
```

Migration `017_telemetry_consistency` adds stable crash report IDs and session
metadata with daily device counters. Stop the backend during the migration and
backfill, then start the new image. The migration leaves historic session
dimensions `Unknown`. To restore them, run
`backend/scripts/backfill_session_device_info.sql` once with `psql` while the
backend keeps running: raw events do not retain their session ID, so a session
takes the first event of its device on the same UTC day, and sessions without
one stay `Unknown`. The legacy event-based device counters are retained for compatibility; the web
now uses session counts and exact inclusive timestamp filters.

The updated Android SDK persists a `report_id` before delivery, including queued
reports from earlier SDK versions. Retries are deduplicated per app. Older SDKs
remain accepted, but reports without an ID cannot be deduplicated reliably.
Deploy the backend before distributing the updated SDK for retry protection.

Migrations `018_access_tokens` and `019_oauth` add personal access tokens and
the OAuth 2.1 server for MCP clients; they only create tables. The MCP endpoint
(`/mcp`) and OAuth discovery (`/.well-known/oauth-*`) are served only when
`BASE_URL` is an `https://` origin (or `http://localhost`): OAuth clients bind
their tokens to that exact address.

Frontend regressions run with `npm test` in `frontend` (Node.js 22.13+).

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | Required |
| `S3_ACCESS_KEY` | MinIO/S3 access key | Required |
| `S3_SECRET_KEY` | MinIO/S3 secret key | Required |
| `S3_BUCKET` | Bucket for mapping files | `bananalytics` |
| `REGISTRATION_ENABLED` | Allow new user registration | `false` (prod) |
| `MAX_APK_SIZE_MB` | Largest APK accepted by release upload | `200` |
| `SMTP_HOST` | SMTP server host | — |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASSWORD` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `noreply@bananalytics.local` |
| `SMTP_FROM_NAME` | Sender display name | `Bananalytics` |
| `BASE_URL` | Public origin: invitation links, MCP and OAuth addresses | `http://localhost:5173` |
| `OUTBOUND_PROXY_URL` | HTTP CONNECT proxy for fetching OAuth client metadata (`http://user:password@host:port`), if the host cannot reach e.g. claude.ai | — |

**Note:** SMTP is optional. If not configured, invitations are created but no emails are sent — you'll need to share registration links manually.

## Android SDK

Official Android SDK: **[bananalytics-android](https://github.com/solkin/bananalytics-android)**

### Installation (JitPack)

```gradle
// settings.gradle
dependencyResolutionManagement {
    repositories {
        maven { url 'https://jitpack.io' }
    }
}

// build.gradle
dependencies {
    implementation 'com.github.solkin:bananalytics-android:<version>'
}
```

> Check the [SDK repository](https://github.com/solkin/bananalytics-android/releases) for the latest version.

### Quick Start

```kotlin
val bananalytics = BananalyticsImpl(
    filesDir = context.filesDir,
    config = BananalyticsConfig(
        baseUrl = "https://your-server.com",
        apiKey = "bnn_xxxxx"
    ),
    environmentProvider = MyEnvironmentProvider(),
    isDebug = BuildConfig.DEBUG
)

// Install early in Application.onCreate()
bananalytics.install()

// Track events
bananalytics.trackEvent("button_click", mapOf("screen" to "home"), mapOf("load_time" to 1.5))

// Leave breadcrumbs
bananalytics.leaveBreadcrumb("Opened settings", BreadcrumbCategory.NAVIGATION)
```

See full documentation in the [SDK repository](https://github.com/solkin/bananalytics-android).

## API

See full API documentation with request/response contracts: **[docs/API.md](docs/API.md)**

Quick overview:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/events/submit` | API Key (sdk) | Submit events from SDK |
| `POST /api/v1/crashes/submit` | API Key (sdk) | Submit crashes from SDK |
| `POST /api/v1/releases` | API Key (upload) | Publish a build from CI |
| `POST /api/v1/auth/login` | — | Login |
| `GET /api/v1/apps` | Session | List apps |
| `GET /api/v1/apps/{id}/keys` | Session | List app API keys |
| `GET /api/v1/apps/{id}/crashes` | Session | Get crash groups |

### Publishing a release from CI

Create an `upload`-scoped API key under Settings → API keys, put it into your CI
secrets, and add one step after the build:

```bash
curl -f -X POST https://your-server.com/api/v1/releases \
  -H "X-API-Key: $BANANALYTICS_KEY" \
  -F apk=@app/build/outputs/apk/release/app-release.apk \
  -F mapping=@app/build/outputs/mapping/release/mapping.txt \
  -F release_notes="$(git log -1 --pretty=%s)" \
  -F notify=true
```

Version code and name are read from the APK, and the response carries a download
link for testers. Re-running the same build overwrites it instead of failing.

## MCP for AI agents

The server speaks the [Model Context Protocol](https://modelcontextprotocol.io) at
`https://your-server.com/mcp` (stateless Streamable HTTP). Agents see exactly the
apps their user sees, with that user's current role:

```bash
claude mcp add --transport http bananalytics https://your-server.com/mcp
```

Clients that support OAuth open a consent page and sign in; others send a
personal access token from the Account page as `Authorization: Bearer bnp_…`.
Tools are read-only unless the person allows changes, which then also need the
admin role in the app. See **Docs, Connect an AI agent** in the web UI.

## Tech Stack

- **Backend**: Kotlin, Ktor, Exposed, PostgreSQL, R8 Retrace
- **Frontend**: React, TypeScript, Vite
- **Infrastructure**: Docker, Docker Compose, Nginx, MinIO

## License

Apache 2.0

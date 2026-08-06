# Bananalytics API Reference

Base URL: `/api/v1`

## Authentication

### SDK Endpoints
Use `X-API-Key` header with any active `sdk`-scoped API key of the app. An app
can have as many named keys as needed — see [API Key Endpoints](#api-key-endpoints).

### Release Publishing
Use `X-API-Key` header with an `upload`-scoped key. SDK keys are rejected: they
ship inside the app, so anyone who unpacks a build would be able to publish
releases. See [POST /releases](#post-releases).

### Admin Endpoints
Session-based authentication via cookies. Login first to get a session.

---

## Auth Endpoints

### GET /auth/config
Get server configuration.

**Response:**
```json
{
  "registration_enabled": true,
  "smtp_configured": true
}
```

### POST /auth/check-email
Check if a user with this email exists.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "exists": true,
  "smtp_configured": true
}
```

### GET /auth/invite/{token}
Get invitation info by token. Used to pre-fill registration form.

**Response:**
```json
{
  "email": "invited@example.com"
}
```

**Errors:**
- `404` - Invalid or expired invitation

### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe",
  "invite_token": "abc123..."
}
```

**Notes:**
- Registration is allowed if `registration_enabled` is true, OR if the user has pending invitations
- `invite_token` is optional — used when registering via invitation link
- If email matches pending invitations, access is automatically granted to invited projects
- All pending invitations for this email are processed upon registration

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-01-10T12:00:00Z"
  }
}
```

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-01-10T12:00:00Z"
  }
}
```

### POST /auth/logout
Logout current session.

**Response:** `204 No Content`

### GET /auth/me
Get current user.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-01-10T12:00:00Z"
  }
}
```

---

## SDK Endpoints

### POST /events/submit
Submit analytics events from mobile app.

**Headers:** `X-API-Key: bnn_xxxxx`

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment": {
    "package_name": "com.example.app",
    "app_version": 123,
    "app_version_name": "1.2.3",
    "device_id": "uuid",
    "os_version": 34,
    "manufacturer": "Google",
    "model": "Pixel 7",
    "country": "US",
    "language": "en"
  },
  "events": [
    {
      "name": "button_click",
      "tags": { "screen": "home" },
      "fields": { "load_time": 1.5 },
      "time": 1704067200000
    }
  ]
}
```

**Notes:**
- `session_id` (optional) - UUID for session tracking, used for unique session statistics
- `app_version_name` is optional but recommended
- If version doesn't exist, it will be auto-created
- If events are muted for this version, data will be silently ignored

**Response:** `200 OK`
```json
{ "status": 200 }
```

### POST /crashes/submit
Submit crash reports from mobile app.

**Headers:** `X-API-Key: bnn_xxxxx`

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "environment": {
    "package_name": "com.example.app",
    "app_version": 123,
    "app_version_name": "1.2.3",
    "device_id": "uuid",
    "os_version": 34,
    "manufacturer": "Google",
    "model": "Pixel 7",
    "country": "US",
    "language": "en"
  },
  "crashes": [
    {
      "timestamp": 1704067199000,
      "thread": "main",
      "stacktrace": "java.lang.NullPointerException...",
      "is_fatal": true,
      "context": { "screen": "details" },
      "breadcrumbs": [
        {
          "timestamp": 1704067190000,
          "message": "HomeActivity",
          "category": "navigation"
        }
      ]
    }
  ]
}
```

**Notes:**
- `session_id` (optional) - UUID for session tracking, used for crash-free session statistics
- `app_version_name` is optional but recommended
- If version doesn't exist, it will be auto-created
- Crash will be deobfuscated if mapping exists for this version
- If crashes are muted for this version, data will be silently ignored

**Response:** `200 OK`
```json
{ "status": 200 }
```

---

## Session Endpoints

### GET /apps/{id}/sessions/crash-free
Get crash-free session statistics by day.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  {
    "date": "2026-01-10",
    "total_sessions": 100,
    "crash_free_sessions": 95,
    "crash_free_rate": 95.0
  }
]
```

### GET /apps/{id}/sessions/crash-free-by-version
Get crash-free session statistics by day, broken down by app version.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  {
    "date": "2026-01-10",
    "version_code": 123,
    "version_name": "1.2.3",
    "count": 50
  }
]
```

**Note:** Returns sessions grouped by version, used for the crash-free sessions chart on the Crashes page.

### GET /apps/{id}/sessions/unique
Get unique sessions count by day and version.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  {
    "date": "2026-01-10",
    "version_code": 123,
    "version_name": "1.2.3",
    "count": 50
  }
]
```

---

## Apps Endpoints

### GET /apps
List apps accessible to current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My App",
    "package_name": "com.example.app",
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

### POST /apps
Create a new app.

**Request:**
```json
{
  "name": "My App",
  "package_name": "com.example.app"
}
```

**Response:** `201 Created`

A `Default` API key is created together with the app. This is the only response
that ever contains a key value — keys are stored hashed.

```json
{
  "id": "uuid",
  "name": "My App",
  "package_name": "com.example.app",
  "created_at": "2026-01-10T12:00:00Z",
  "api_key": "bnn_xxxxx"
}
```

### DELETE /apps/{id}
Delete an application and all associated data (crashes, events, versions, access).

**Response:** `204 No Content`

---

## API Key Endpoints

An app can have any number of named keys. Only the SHA-256 hash of a key is
stored, so a key value is returned exactly once — in the response that created
it. All endpoints below require the `admin` role on the app.

Every key has a scope, and it is enforced on every request:

| Scope | Authenticates | Notes |
|-------|---------------|-------|
| `sdk` | `/events/submit`, `/crashes/submit` | Default. Ships inside the app. |
| `upload` | `/releases` | Belongs in CI secrets, never in a build. |

### GET /apps/{id}/keys
List keys of an app. Values are never returned, only their prefix.

**Response:**
```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "name": "Production build",
    "scope": "sdk",
    "key_prefix": "bnn_AbCd1234",
    "created_by": "Jane Doe",
    "last_used_at": "2026-01-10T12:00:00Z",
    "revoked_at": null,
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

`last_used_at` is refreshed at most once every 5 minutes per key.

### POST /apps/{id}/keys
Create a key.

**Request:**
```json
{ "name": "Production build", "scope": "sdk" }
```

`scope` is optional and defaults to `sdk`; pass `upload` for a key that
publishes releases from CI.

**Response:** `201 Created`
```json
{
  "key": { "id": "uuid", "name": "Production build", "scope": "sdk", "key_prefix": "bnn_AbCd1234", "...": "..." },
  "api_key": "bnn_AbCd1234efgh..."
}
```

**Errors:**
- `400` - Name is empty or longer than 100 characters, or scope is not `sdk`/`upload`

### PUT /apps/{id}/keys/{keyId}
Rename a key.

**Request:**
```json
{ "name": "CI pipeline" }
```

**Response:** `204 No Content`

### POST /apps/{id}/keys/{keyId}/revoke
Revoke a key. It stops authenticating immediately and stays listed with
`revoked_at` set.

**Response:** `204 No Content`

### DELETE /apps/{id}/keys/{keyId}
Delete a key permanently, dropping its usage history.

**Response:** `204 No Content`

---

## Versions Endpoints

### GET /apps/{id}/versions
List versions for an app.

**Response:**
```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "version_code": 123,
    "version_name": "1.2.3",
    "has_mapping": true,
    "mute_crashes": false,
    "mute_events": false,
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

### POST /apps/{id}/versions
Create a new version with optional mapping file.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `version_code` (required): Version code number
- `version_name` (optional): Version name string (e.g., "1.2.3")
- `mapping` (optional): R8/ProGuard mapping file, plain or gzipped

### PUT /apps/{appId}/versions/{versionId}/mapping
Upload or update mapping file for a version.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `mapping` (required): R8/ProGuard mapping file, plain or gzipped

Mappings are stored gzipped whichever way they arrive, so uploading
`mapping.txt.gz` saves both the transfer and the compression step.

### PUT /apps/{appId}/versions/{versionId}
Update version settings (release notes, publishing, mute settings).

**Request:**
```json
{
  "release_notes": "Bug fixes and improvements",
  "published_for_testers": true,
  "mute_crashes": false,
  "mute_events": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "app_id": "uuid",
  "version_code": 123,
  "version_name": "1.2.3",
  "has_mapping": true,
  "has_apk": true,
  "apk_size": 45000000,
  "apk_filename": "app-release.apk",
  "apk_uploaded_at": "2026-01-10T12:00:00Z",
  "release_notes": "Bug fixes and improvements",
  "published_for_testers": true,
  "mute_crashes": false,
  "mute_events": false,
  "created_at": "2026-01-10T12:00:00Z"
}
```

### PUT /apps/{appId}/versions/{versionId}/mute
Update mute settings for a version (legacy, prefer PUT /versions/{id}).

When crashes or events are muted for a version, SDK submissions will be silently ignored (return success without storing data).

**Request:**
```json
{
  "mute_crashes": true,
  "mute_events": false
}
```

### PUT /apps/{appId}/versions/{versionId}/apk
Upload APK file for a version.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `apk` (required): APK file (max 200MB)

**Response:** Updated version object

### GET /apps/{appId}/versions/{versionId}/apk
Download APK file for a version.

**Response:** Binary APK file with Content-Disposition header

### DELETE /apps/{appId}/versions/{versionId}/apk
Delete APK file from a version.

**Response:** `204 No Content`

### POST /apps/{appId}/versions/{versionId}/download-link
Create a temporary public download link for APK.

**Request:**
```json
{
  "expires_in_hours": 24
}
```

**Response:**
```json
{
  "token": "abc123...",
  "download_url": "/api/v1/download/abc123...",
  "expires_at": "2026-01-11T12:00:00Z"
}
```

---

## Release Publishing

### POST /releases
Publish a build in one request — meant for CI. The app is identified by the API
key, and the version by the APK itself, so a pipeline only has to hand over the
file.

**Authentication:** `X-API-Key` with an `upload`-scoped key.

**Request:** `multipart/form-data`

| Part | Type | Required | Description |
|------|------|----------|-------------|
| `apk` | file | yes | The build to publish |
| `mapping` | file | no | R8/ProGuard mapping for this build — gzip it, plain text is accepted too |
| `release_notes` | text | no | Shown to testers; keeps the previous notes if omitted |
| `version_code` | text | no | Overrides the value read from the APK |
| `version_name` | text | no | Overrides the value read from the APK |
| `publish` | text | no | Publish for testers, default `true` |
| `notify` | text | no | Email admins and testers, default `false` |
| `link_expires_in_hours` | text | no | Lifetime of the returned link, default `720` (30 days), max `8760` |

Booleans accept `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`.

```bash
gzip -9 -c app/build/outputs/mapping/release/mapping.txt > mapping.txt.gz

curl --fail-with-body -X POST https://your-server.com/api/v1/releases \
  -H "X-API-Key: $BANANALYTICS_KEY" \
  -F apk=@app/build/outputs/apk/release/app-release.apk \
  -F mapping=@mapping.txt.gz \
  -F release_notes="$(git log -1 --pretty=%s)" \
  -F notify=true
```

**Response:** `201 Created`
```json
{
  "app_id": "uuid",
  "version_id": "uuid",
  "version_code": 1092,
  "version_name": "21.0",
  "release_notes": "Fix crash on startup",
  "published_for_testers": true,
  "has_mapping": true,
  "apk_size": 3972684,
  "download_url": "https://your-server.com/api/v1/download/e6ceb82d...",
  "expires_at": "2026-08-24T17:08:38Z",
  "notified": 4
}
```

**Notes:**
- `version_code` and `version_name` are read from the APK's `AndroidManifest.xml`.
  A `versionName` defined as a resource reference (`@string/version`) cannot be
  resolved from the manifest alone — pass `version_name` explicitly in that case.
- The APK's package name must match the app, otherwise the request is rejected.
  This is what keeps a build from landing in the wrong project.
- Re-publishing the same `version_code` overwrites the existing version instead
  of failing, so a retried pipeline is safe. `release_notes`, `version_name` and
  `mapping` that are not sent keep their previous values.
- A release mapping is tens of megabytes of text and is stored gzipped anyway,
  so send it that way: it compresses about tenfold. An uncompressed file still
  works — the server compresses it before storing.
- `notify` mails everyone with the `admin` or `tester` role, 500 ms apart.
  Without SMTP configured the release still publishes and `notified` is `0`.
- Upload ceiling is `MAX_APK_SIZE_MB` (default 200). Keep nginx
  `client_max_body_size` above it.

**Errors:**
- `400` - Missing, empty or duplicated `apk`, unreadable APK, package mismatch, no version code, bad field value
- `401` - Missing key, revoked key, or a key that is not `upload`-scoped
- `413` - APK or mapping larger than the configured limit

---

## Distribution Endpoints

### GET /apps/{appId}/members
Get all members of an app (for notification dialog).

**Response:**
```json
[
  {
    "email": "admin@example.com",
    "name": "John Admin",
    "role": "admin"
  },
  {
    "email": "tester@example.com",
    "name": null,
    "role": "tester"
  }
]
```

### POST /apps/{appId}/versions/{versionId}/notify-testers
Send notification emails about new version to selected users.

**Request:**
```json
{
  "emails": ["tester1@example.com", "tester2@example.com"]
}
```

**Response:**
```json
{
  "sent": 2,
  "failed": 0
}
```

**Notes:**
- Requires SMTP to be configured
- Emails are sent with 500ms delay between each to avoid overloading SMTP
- Returns count of successfully sent and failed emails

### GET /apps/{id}/distribution
Get published versions for testers (versions with APK and `published_for_testers` = true).

**Response:**
```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "version_code": 123,
    "version_name": "1.2.3",
    "has_mapping": true,
    "has_apk": true,
    "apk_size": 45000000,
    "apk_filename": "app-release.apk",
    "apk_uploaded_at": "2026-01-10T12:00:00Z",
    "release_notes": "Bug fixes and improvements",
    "published_for_testers": true,
    "mute_crashes": false,
    "mute_events": false,
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

### GET /download/{token}
**Public endpoint** - Download APK via temporary token (no authentication required).

**Response:** Binary APK file with Content-Disposition header

**Note:** Returns 404 if token is invalid or expired.

---

## Crashes Endpoints

### GET /apps/{id}/crashes
Get crash groups for an app.

**Query params:** `status` (open|resolved|ignored), `page`, `pageSize`

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "app_id": "uuid",
      "exception_class": "java.lang.NullPointerException",
      "exception_message": "Attempt to invoke...",
      "first_seen": "2026-01-10T12:00:00Z",
      "last_seen": "2026-01-10T14:00:00Z",
      "occurrences": 42,
      "status": "open"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### GET /crash-groups/{id}/crashes
Get individual crashes in a group.

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "app_id": "uuid",
      "group_id": "uuid",
      "version_code": 123,
      "stacktrace_raw": "java.lang.NullPointerException...",
      "stacktrace_decoded": "com.example.MyClass.method()...",
      "thread": "main",
      "is_fatal": true,
      "context": { "screen": "details" },
      "breadcrumbs": [...],
      "device_info": {
        "device_id": "uuid",
        "os_version": 34,
        "manufacturer": "Google",
        "model": "Pixel 7",
        "country": "US",
        "language": "en"
      },
      "created_at": "2026-01-10T12:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

### PUT /crash-groups/{id}
Update crash group status.

**Request:**
```json
{ "status": "resolved" }
```

### DELETE /crash-groups/{id}
Delete a crash group and all associated crashes.

**Response:** `204 No Content`

### GET /apps/{id}/crashes/stats
Get crash statistics over time for an app.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  { "date": "2026-01-10", "count": 15 },
  { "date": "2026-01-11", "count": 8 }
]
```

### GET /crash-groups/{id}/stats
Get crash statistics over time for a specific crash group.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  { "date": "2026-01-10", "count": 5 },
  { "date": "2026-01-11", "count": 3 }
]
```

### GET /apps/{id}/crashes/versions
Get available version codes that have crashes.

**Response:**
```json
[
  { "version_code": 123, "version_name": "1.2.3" },
  { "version_code": 122, "version_name": "1.2.2" }
]
```

### POST /crashes/{id}/retrace
Re-deobfuscate a crash stacktrace.

**Response:** Updated crash object

---

## Access Endpoints

### GET /apps/{id}/access
List users and pending invitations for an app.

**Response:**
```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "user_id": "uuid",
    "user_email": "user@example.com",
    "user_name": "John Doe",
    "role": "admin",
    "status": "active",
    "created_at": "2026-01-10T12:00:00Z"
  },
  {
    "id": "uuid",
    "app_id": "uuid",
    "user_id": null,
    "user_email": "invited@example.com",
    "user_name": null,
    "role": "viewer",
    "status": "invited",
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

**Notes:**
- `status` is `active` for registered users, `invited` for pending invitations
- `user_id` and `user_name` are `null` for invitations

### POST /apps/{id}/access
Grant access to a user or send invitation.

**Request:**
```json
{
  "email": "teammate@example.com",
  "role": "viewer"
}
```

**Behavior:**
- If user exists: grants access immediately
- If user doesn't exist: creates invitation
  - If SMTP is configured: sends invitation email with registration link
  - If SMTP is not configured: creates invitation without sending email

**Response for existing user:** `201 Created`
```json
{
  "id": "uuid",
  "app_id": "uuid",
  "user_id": "uuid",
  "user_email": "teammate@example.com",
  "user_name": "Team Mate",
  "role": "viewer",
  "status": "active",
  "created_at": "2026-01-10T12:00:00Z"
}
```

**Response for new invitation:** `201 Created`
```json
{
  "id": "uuid",
  "email": "invited@example.com",
  "app_id": "uuid",
  "role": "viewer",
  "created_at": "2026-01-10T12:00:00Z"
}
```

### PUT /apps/{id}/access/{accessId}
Update user's or invitation's role.

**Request:**
```json
{ "role": "admin" }
```

**Note:** `accessId` can be either a user ID (for active access) or an invitation ID (for pending invitations).

### DELETE /apps/{id}/access/{accessId}
Revoke user's access or cancel invitation.

**Response:** `204 No Content`

**Note:** `accessId` can be either a user ID (for active access) or an invitation ID (for pending invitations).

### GET /apps/{id}/access/{invitationId}/link
Get the invitation registration link.

**Response:**
```json
{
  "url": "https://your-domain.com/register?invite=abc123..."
}
```

**Note:** Only works for pending invitations.

### POST /apps/{id}/access/{invitationId}/resend
Resend the invitation email.

**Response:**
```json
{
  "status": "sent"
}
```

**Note:** Requires SMTP to be configured. Returns 400 error if SMTP is not available.

### GET /apps/{id}/my-role
Get current user's role for an app.

**Response:**
```json
{ "role": "admin" }
```

**Roles:**
- `admin` - Full access including settings and access management
- `viewer` - Can view crashes, events, and versions
- `tester` - Can only access Distribution page and download APKs

## Invitation Flow

1. Admin calls `POST /apps/{id}/access` with email of non-registered user
2. System creates invitation record and (if SMTP configured) sends email
3. User clicks link in email: `/register?invite=<token>`
4. User registers → all pending invitations for this email are processed
5. User automatically gets access to all invited projects

**Notes:**
- Invitations expire after 30 days
- Registration via invite link works even when `registration_enabled` is `false`
- If user registers normally (without invite link), pending invitations are still processed

---

## Events Endpoints

### GET /apps/{id}/events/summary
Get aggregated event statistics.

**Query params:** `version` (filter by version code)

**Response:**
```json
[
  {
    "name": "button_click",
    "total": 15420,
    "this_month": 3200,
    "today": 150
  }
]
```

### GET /apps/{id}/events/versions
Get available version codes for filtering.

**Response:**
```json
[123, 122, 121]
```

### GET /apps/{id}/events/by-name/{eventName}
Get events by name with pagination.

**Query params:** `version`, `page`, `pageSize`

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "app_id": "uuid",
      "version_code": 123,
      "name": "button_click",
      "tags": { "screen": "home" },
      "fields": { "load_time": 1.5 },
      "device_info": {...},
      "created_at": "2026-01-10T12:00:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "pageSize": 50
}
```

### GET /apps/{id}/events/by-name/{eventName}/versions
Get version statistics for a specific event.

**Response:**
```json
[
  { "version_code": 123, "version_name": "1.2.3", "count": 500 },
  { "version_code": 122, "version_name": "1.2.2", "count": 320 }
]
```

### GET /apps/{id}/events/by-name/{eventName}/stats
Get event statistics over time.

**Query params:** `from`, `to` (ISO datetime, defaults to last 14 days)

**Response:**
```json
[
  { "date": "2026-01-10", "count": 150 },
  { "date": "2026-01-11", "count": 120 }
]
```

### GET /apps/{id}/events
Get events for an app (with filters).

**Query params:** `name`, `version`, `from`, `to`, `page`, `pageSize`

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "app_id": "uuid",
      "version_code": 123,
      "name": "button_click",
      "tags": { "screen": "home" },
      "fields": { "load_time": 1.5 },
      "device_info": {...},
      "created_at": "2026-01-10T12:00:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "pageSize": 50
}
```

### GET /apps/{id}/events/names
Get distinct event names.

**Response:**
```json
["app_open", "button_click", "purchase"]
```

### GET /apps/{id}/events/count
Get total event count for an app.

**Response:**
```json
{ "count": 15420 }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "error_code",
  "message": "Human readable message"
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `bad_request` | 400 | Invalid request data |
| `unauthorized` | 401 | Missing or invalid authentication |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `internal_error` | 500 | Server error |

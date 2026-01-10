# Bananalytics API Reference

Base URL: `/api/v1`

## Authentication

### SDK Endpoints
Use `X-API-Key` header with your app's API key.

### Admin Endpoints
Session-based authentication via cookies. Login first to get a session.

---

## Auth Endpoints

### GET /auth/config
Get server configuration.

**Response:**
```json
{
  "registration_enabled": true
}
```

### POST /auth/register
Register a new user (if enabled).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe"
}
```

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
- `app_version_name` is optional but recommended
- If version doesn't exist, it will be auto-created

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
- `app_version_name` is optional but recommended
- If version doesn't exist, it will be auto-created
- Crash will be deobfuscated if mapping exists for this version

**Response:** `200 OK`
```json
{ "status": 200 }
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
    "api_key": "bnn_xxxxx",
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
```json
{
  "id": "uuid",
  "name": "My App",
  "package_name": "com.example.app",
  "api_key": "bnn_xxxxx",
  "created_at": "2026-01-10T12:00:00Z"
}
```

### POST /apps/{id}/regenerate-key
Regenerate API key for an app.

**Response:**
```json
{ "api_key": "bnn_new_key" }
```

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
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

### POST /apps/{id}/versions
Create a new version with optional mapping.

**Request:**
```json
{
  "version_code": 123,
  "version_name": "1.2.3",
  "mapping_content": "# R8 mapping file content..."
}
```

### PUT /apps/{appId}/versions/{versionId}/mapping
Upload or update mapping file.

**Request:** Plain text mapping file content

**Content-Type:** `text/plain`

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

### POST /crashes/{id}/retrace
Re-deobfuscate a crash stacktrace.

**Response:** Updated crash object

---

## Access Endpoints

### GET /apps/{id}/access
List users with access to an app.

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
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

### POST /apps/{id}/access
Grant access to a user.

**Request:**
```json
{
  "email": "teammate@example.com",
  "role": "viewer"
}
```

### PUT /apps/{id}/access/{userId}
Update user's role.

**Request:**
```json
{ "role": "admin" }
```

### DELETE /apps/{id}/access/{userId}
Revoke user's access.

**Response:** `204 No Content`

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
  { "version_code": 123, "count": 500 },
  { "version_code": 122, "count": 320 }
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

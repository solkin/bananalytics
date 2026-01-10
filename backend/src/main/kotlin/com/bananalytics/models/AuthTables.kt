package com.bananalytics.models

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

object Users : UUIDTable("users") {
    val email = varchar("email", 255).uniqueIndex()
    val passwordHash = varchar("password_hash", 255)
    val name = varchar("name", 255).nullable()
    val createdAt = timestampWithTimeZone("created_at")
}

object Sessions : UUIDTable("sessions") {
    val userId = reference("user_id", Users)
    val expiresAt = timestampWithTimeZone("expires_at")
    val createdAt = timestampWithTimeZone("created_at")
}

object AppAccess : UUIDTable("app_access") {
    val appId = reference("app_id", Apps)
    val userId = reference("user_id", Users)
    val role = varchar("role", 20).default("viewer")  // "admin", "viewer", or "tester"
    val createdAt = timestampWithTimeZone("created_at")

    init {
        uniqueIndex(appId, userId)
    }
}

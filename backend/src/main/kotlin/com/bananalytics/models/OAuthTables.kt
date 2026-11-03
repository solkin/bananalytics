package com.bananalytics.models

import kotlinx.serialization.json.Json
import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

object OAuthClients : UUIDTable("oauth_clients") {
    val clientId = varchar("client_id", 512).uniqueIndex()
    val clientName = varchar("client_name", 200)
    val redirectUris = jsonb<List<String>>("redirect_uris", Json)
    val kind = varchar("kind", 16)
    val createdAt = timestampWithTimeZone("created_at")
}

object OAuthGrants : UUIDTable("oauth_grants") {
    val clientId = reference("client_id", OAuthClients)
    val userId = reference("user_id", Users)
    val scope = varchar("scope", 100)
    val refreshTokenHash = varchar("refresh_token_hash", 64).uniqueIndex()
    val previousRefreshTokenHash = varchar("previous_refresh_token_hash", 64).nullable()
    val refreshExpiresAt = timestampWithTimeZone("refresh_expires_at")
    val lastUsedAt = timestampWithTimeZone("last_used_at").nullable()
    val createdAt = timestampWithTimeZone("created_at")
}

object OAuthCodes : Table("oauth_codes") {
    val codeHash = varchar("code_hash", 64)
    val clientId = reference("client_id", OAuthClients)
    val userId = reference("user_id", Users)
    val redirectUri = text("redirect_uri")
    val scope = varchar("scope", 100)
    val codeChallenge = varchar("code_challenge", 128)
    val expiresAt = timestampWithTimeZone("expires_at")
    val usedAt = timestampWithTimeZone("used_at").nullable()
    val grantId = reference("grant_id", OAuthGrants).nullable()
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(codeHash)
}

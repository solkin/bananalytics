package com.bananalytics.config

import com.bananalytics.repositories.AccessTokenRepository
import com.bananalytics.repositories.TokenPrincipal
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.util.*

private val TokenPrincipalKey = AttributeKey<TokenPrincipal>("tokenPrincipal")
private const val BEARER_PREFIX = "Bearer "

fun ApplicationCall.getTokenPrincipal(): TokenPrincipal =
    attributes.getOrNull(TokenPrincipalKey) ?: throw UnauthorizedException("Not authenticated")

/**
 * Resolves `Authorization: Bearer <access token>` before any handler below it
 * runs. Tokens never travel in the query string or in cookies, so a page in a
 * browser cannot make an agent's request on its own.
 *
 * [challenge] lists the `WWW-Authenticate` parameters a refused client
 * receives — this is where an OAuth client learns where to authorize.
 */
class BearerAuthenticationConfig {
    var challenge: () -> Map<String, String> = { emptyMap() }
}

val BearerAuthentication = createRouteScopedPlugin("BearerAuthentication", ::BearerAuthenticationConfig) {
    val challenge = pluginConfig.challenge
    onCall { call ->
        val token = call.request.header(HttpHeaders.Authorization)
            ?.takeIf { it.startsWith(BEARER_PREFIX, ignoreCase = true) }
            ?.substring(BEARER_PREFIX.length)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        val principal = token?.let { dbIO { AccessTokenRepository.authenticate(it) } }
        if (principal == null) {
            val parameters = challenge() + if (token == null) emptyMap() else mapOf("error" to "invalid_token")
            call.response.header(HttpHeaders.WWWAuthenticate, bearerChallenge(parameters))
            throw UnauthorizedException(if (token == null) "Access token required" else "Invalid or expired access token")
        }
        call.attributes.put(TokenPrincipalKey, principal)
    }
}

internal fun bearerChallenge(parameters: Map<String, String>): String =
    if (parameters.isEmpty()) "Bearer"
    else "Bearer " + parameters.entries.joinToString(", ") { (key, value) -> "$key=\"$value\"" }

package com.bananalytics.services

import com.bananalytics.config.AppConfig
import com.bananalytics.config.OAuthException
import com.bananalytics.config.dbIO
import com.bananalytics.models.*
import com.bananalytics.repositories.AccessTokenRepository
import com.bananalytics.repositories.OAuthClient
import com.bananalytics.repositories.OAuthClientRepository
import com.bananalytics.repositories.OAuthGrantRepository
import com.bananalytics.repositories.Redemption
import io.ktor.http.*
import java.net.URI
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64

/**
 * The OAuth 2.1 authorization server MCP clients sign people in through
 * (authorization code with PKCE, public clients only). Its tokens are good for
 * the MCP endpoint and nothing else.
 */
class OAuthService(
    private val issuer: String,
    private val resource: String,
    private val clientMetadata: ClientMetadataSource
) {
    private sealed interface Authorization {
        data class Ready(
            val client: OAuthClient,
            val redirectUri: String,
            val scopes: Set<String>,
            val codeChallenge: String,
            val state: String?
        ) : Authorization

        data class Refused(val redirectTo: String) : Authorization
    }

    val protectedResourceMetadata = ProtectedResourceMetadata(
        resource = resource,
        authorizationServers = listOf(issuer),
        scopesSupported = SCOPES
    )

    val authorizationServerMetadata = AuthorizationServerMetadata(
        issuer = issuer,
        authorizationEndpoint = "$issuer/oauth/authorize",
        tokenEndpoint = "$issuer/api/v1/oauth/token",
        registrationEndpoint = "$issuer/api/v1/oauth/register",
        revocationEndpoint = "$issuer/api/v1/oauth/revoke",
        scopesSupported = SCOPES
    )

    suspend fun register(request: ClientRegistrationRequest): ClientRegistrationResponse {
        if (request.tokenEndpointAuthMethod != null && request.tokenEndpointAuthMethod != "none") {
            throw OAuthException("invalid_client_metadata", "Only public clients are supported: token_endpoint_auth_method must be none")
        }
        if (request.grantTypes != null && !SUPPORTED_GRANTS.containsAll(request.grantTypes)) {
            throw OAuthException("invalid_client_metadata", "Supported grant types: ${SUPPORTED_GRANTS.joinToString()}")
        }
        if (request.responseTypes != null && request.responseTypes.any { it != "code" }) {
            throw OAuthException("invalid_client_metadata", "Only the code response type is supported")
        }
        val redirectUris = validRedirectUris(request.redirectUris, "invalid_redirect_uri")
        val name = request.clientName?.trim()?.takeIf { it.isNotEmpty() }?.take(MAX_NAME_LENGTH) ?: "MCP client"

        val client = dbIO { OAuthClientRepository.register(name, redirectUris) }
        return ClientRegistrationResponse(
            clientId = client.clientId,
            clientIdIssuedAt = Instant.now().epochSecond,
            clientName = client.name,
            redirectUris = client.redirectUris
        )
    }

    suspend fun check(request: AuthorizationRequest): AuthorizationCheck =
        when (val authorization = prepare(request)) {
            is Authorization.Refused -> AuthorizationCheck(redirectTo = authorization.redirectTo)
            is Authorization.Ready -> AuthorizationCheck(
                prompt = AuthorizationPrompt(
                    clientName = authorization.client.name,
                    clientId = authorization.client.clientId,
                    verified = authorization.client.verified,
                    redirectHost = RedirectUris.host(authorization.redirectUri),
                    requestsWrite = AccessTokenRepository.SCOPE_WRITE in authorization.scopes
                )
            )
        }

    suspend fun decide(userId: java.util.UUID, decision: AuthorizationDecision): AuthorizationRedirect {
        val ready = when (val authorization = prepare(decision.request)) {
            is Authorization.Refused -> return AuthorizationRedirect(authorization.redirectTo)
            is Authorization.Ready -> authorization
        }
        if (!decision.approve) {
            return AuthorizationRedirect(errorRedirect(ready.redirectUri, ready.state, "access_denied", "The person declined access"))
        }
        val scopes = AccessTokenRepository.scopesFor(decision.allowWrite && AccessTokenRepository.SCOPE_WRITE in ready.scopes)
        val code = dbIO {
            OAuthGrantRepository.createCode(ready.client.id, userId, ready.redirectUri, scopes, ready.codeChallenge)
        }
        return AuthorizationRedirect(redirect(ready.redirectUri, listOfNotNull("code" to code, ready.state?.let { "state" to it })))
    }

    suspend fun token(parameters: Parameters): TokenResponse {
        val client = parameters["client_id"]?.let { dbIO { OAuthClientRepository.findByClientId(it) } }
            ?: throw OAuthException("invalid_client", "Unknown client_id")
        parameters["resource"]?.let { if (normalize(it) != normalize(resource)) throw OAuthException("invalid_target", "The only resource is $resource") }

        val redemption = when (parameters["grant_type"]) {
            "authorization_code" -> {
                val code = parameters.require("code")
                val redirectUri = parameters.require("redirect_uri")
                val verifier = parameters.require("code_verifier")
                if (!PKCE_VERIFIER.matches(verifier)) throw OAuthException("invalid_grant", "Malformed code_verifier")
                dbIO { OAuthGrantRepository.redeemCode(code, client.id, redirectUri) { challenge -> s256(verifier) == challenge } }
            }
            "refresh_token" -> {
                val refresh = parameters.require("refresh_token")
                val scopes = parameters["scope"]?.let(::requestedScopes)
                dbIO { OAuthGrantRepository.refresh(refresh, client.id, scopes) }
            }
            null -> throw OAuthException("invalid_request", "grant_type is required")
            else -> throw OAuthException("unsupported_grant_type", "Supported grant types: ${SUPPORTED_GRANTS.joinToString()}")
        }
        return when (redemption) {
            is Redemption.Issued -> with(redemption.tokens) {
                TokenResponse(accessToken, expiresIn = expiresIn, refreshToken = refreshToken, scope = scopes.sorted().joinToString(" "))
            }
            Redemption.Invalid -> throw OAuthException("invalid_grant", "The grant is invalid, expired or was issued to another client")
            Redemption.Replayed -> throw OAuthException("invalid_grant", "The grant was already used; access has been revoked")
        }
    }

    suspend fun revoke(parameters: Parameters) {
        val token = parameters.require("token")
        val client = parameters["client_id"]?.let { dbIO { OAuthClientRepository.findByClientId(it) } }
            ?: throw OAuthException("invalid_client", "Unknown client_id")
        dbIO { OAuthGrantRepository.revoke(token, client.id) }
    }

    /**
     * Validates an authorization request in the order RFC 6749 asks: until the
     * client and its redirect URI are known good, an error is shown to the
     * person and never sent anywhere; after that, it goes back to the client.
     */
    private suspend fun prepare(request: AuthorizationRequest): Authorization {
        val clientIdValue = request.clientId?.takeIf { it.isNotBlank() }
            ?: throw OAuthException("invalid_request", "client_id is required")
        val client = resolveClient(clientIdValue)
        val redirectUri = request.redirectUri?.let { requested ->
            requested.takeIf { client.redirectUris.any { RedirectUris.matches(it, requested) } }
                ?: throw OAuthException("invalid_request", "redirect_uri is not registered for this client")
        } ?: client.redirectUris.singleOrNull()
            ?: throw OAuthException("invalid_request", "redirect_uri is required")

        fun refuse(error: String, description: String) =
            Authorization.Refused(errorRedirect(redirectUri, request.state, error, description))

        if (request.responseType != "code") return refuse("unsupported_response_type", "Only response_type=code is supported")
        val challenge = request.codeChallenge
        if (challenge == null || request.codeChallengeMethod != "S256" || !PKCE_CHALLENGE.matches(challenge)) {
            return refuse("invalid_request", "PKCE with code_challenge_method=S256 is required")
        }
        if (request.resource != null && normalize(request.resource) != normalize(resource)) {
            return refuse("invalid_target", "The only resource is $resource")
        }
        return Authorization.Ready(client, redirectUri, requestedScopes(request.scope), challenge, request.state)
    }

    /** A URL client_id names a metadata document; anything else was registered here. */
    private suspend fun resolveClient(clientId: String): OAuthClient {
        if (!clientId.startsWith("https://")) {
            return dbIO { OAuthClientRepository.findByClientId(clientId) }
                ?: throw OAuthException("invalid_client", "Unknown client_id")
        }
        val url = metadataUrl(clientId) ?: throw OAuthException("invalid_client", "client_id is not a valid metadata URL")
        val document = clientMetadata.fetch(url)
        if (document.clientId != clientId) {
            throw OAuthException("invalid_client", "client_id in the metadata document does not match its URL")
        }
        if (document.tokenEndpointAuthMethod != null && document.tokenEndpointAuthMethod != "none") {
            throw OAuthException("invalid_client", "Only public clients are supported")
        }
        val redirectUris = validRedirectUris(document.redirectUris, "invalid_client")
        val name = document.clientName?.trim()?.takeIf { it.isNotEmpty() }?.take(MAX_NAME_LENGTH) ?: url.host
        return dbIO { OAuthClientRepository.upsertFromMetadata(clientId, name, redirectUris) }
    }

    private fun validRedirectUris(uris: List<String>, error: String): List<String> {
        if (uris.isEmpty() || uris.size > RedirectUris.MAX_COUNT) {
            throw OAuthException(error, "Between 1 and ${RedirectUris.MAX_COUNT} redirect_uris are required")
        }
        uris.firstOrNull { !RedirectUris.isAllowed(it) }?.let {
            throw OAuthException(error, "redirect_uri is not allowed: $it")
        }
        return uris.distinct()
    }

    private fun errorRedirect(redirectUri: String, state: String?, error: String, description: String) =
        redirect(redirectUri, listOfNotNull("error" to error, "error_description" to description, state?.let { "state" to it }))

    /** Adds the response to the client's redirect URI, issuer included (RFC 9207). */
    private fun redirect(redirectUri: String, parameters: List<Pair<String, String>>): String {
        val query = (parameters + ("iss" to issuer)).formUrlEncode()
        return redirectUri + (if ('?' in redirectUri) "&" else "?") + query
    }

    private fun Parameters.require(name: String): String =
        this[name]?.takeIf { it.isNotEmpty() } ?: throw OAuthException("invalid_request", "$name is required")

    companion object {
        private val SCOPES = listOf(AccessTokenRepository.SCOPE_READ, AccessTokenRepository.SCOPE_WRITE)
        private val SUPPORTED_GRANTS = listOf("authorization_code", "refresh_token")
        private const val MAX_NAME_LENGTH = 100
        private val PKCE_CHALLENGE = Regex("^[A-Za-z0-9_-]{43}$")
        private val PKCE_VERIFIER = Regex("^[A-Za-z0-9._~-]{43,128}$")

        /** Unknown scopes are ignored (RFC 6749 §3.3); write implies read; nothing asked means read. */
        fun requestedScopes(scope: String?): Set<String> {
            val requested = scope.orEmpty().split(' ').filter { it.isNotEmpty() }.toSet()
            return AccessTokenRepository.scopesFor(AccessTokenRepository.SCOPE_WRITE in requested)
        }

        fun s256(verifier: String): String =
            Base64.getUrlEncoder().withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))

        /** Draft CIMD: an HTTPS URL with a path, nothing that could make two URLs name one client. */
        fun metadataUrl(clientId: String): URI? {
            val uri = try { URI(clientId) } catch (e: java.net.URISyntaxException) { return null }
            val path = uri.rawPath ?: return null
            val valid = uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.rawUserInfo == null &&
                uri.rawFragment == null && path.length > 1 && path.split('/').none { it == "." || it == ".." }
            return uri.takeIf { valid }
        }

        /** RFC 8707 resource comparison: scheme and host are case-insensitive, a trailing slash is noise. */
        private fun normalize(value: String): String {
            val uri = try { URI(value) } catch (e: java.net.URISyntaxException) { return value }
            if (uri.scheme == null || uri.host == null) return value
            val port = if (uri.port == -1) "" else ":${uri.port}"
            return "${uri.scheme.lowercase()}://${uri.host.lowercase()}$port${uri.rawPath.orEmpty().trimEnd('/')}"
        }

        /** Built from BASE_URL, or null when the MCP endpoint is disabled. */
        fun fromConfig(): OAuthService? {
            val resource = AppConfig.mcpResourceUrl ?: return null
            return OAuthService(AppConfig.baseUrl, resource, HttpClientMetadataSource(AppConfig.outboundProxy))
        }
    }
}

package com.bananalytics.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** RFC 9728: tells an MCP client which authorization server issues its tokens. */
@Serializable
data class ProtectedResourceMetadata(
    val resource: String,
    @SerialName("authorization_servers") val authorizationServers: List<String>,
    @SerialName("scopes_supported") val scopesSupported: List<String>,
    @SerialName("bearer_methods_supported") val bearerMethodsSupported: List<String> = listOf("header"),
    @SerialName("resource_name") val resourceName: String = "Bananalytics"
)

/** RFC 8414 authorization server metadata. */
@Serializable
data class AuthorizationServerMetadata(
    val issuer: String,
    @SerialName("authorization_endpoint") val authorizationEndpoint: String,
    @SerialName("token_endpoint") val tokenEndpoint: String,
    @SerialName("registration_endpoint") val registrationEndpoint: String,
    @SerialName("revocation_endpoint") val revocationEndpoint: String,
    @SerialName("scopes_supported") val scopesSupported: List<String>,
    @SerialName("response_types_supported") val responseTypesSupported: List<String> = listOf("code"),
    @SerialName("grant_types_supported") val grantTypesSupported: List<String> = listOf("authorization_code", "refresh_token"),
    @SerialName("token_endpoint_auth_methods_supported") val tokenEndpointAuthMethodsSupported: List<String> = listOf("none"),
    @SerialName("revocation_endpoint_auth_methods_supported") val revocationEndpointAuthMethodsSupported: List<String> = listOf("none"),
    @SerialName("code_challenge_methods_supported") val codeChallengeMethodsSupported: List<String> = listOf("S256"),
    @SerialName("client_id_metadata_document_supported") val clientIdMetadataDocumentSupported: Boolean = true,
    @SerialName("authorization_response_iss_parameter_supported") val issParameterSupported: Boolean = true
)

/** RFC 7591 registration request; only what a public client may ask for. */
@Serializable
data class ClientRegistrationRequest(
    @SerialName("redirect_uris") val redirectUris: List<String> = emptyList(),
    @SerialName("client_name") val clientName: String? = null,
    @SerialName("token_endpoint_auth_method") val tokenEndpointAuthMethod: String? = null,
    @SerialName("grant_types") val grantTypes: List<String>? = null,
    @SerialName("response_types") val responseTypes: List<String>? = null
)

@Serializable
data class ClientRegistrationResponse(
    @SerialName("client_id") val clientId: String,
    @SerialName("client_id_issued_at") val clientIdIssuedAt: Long,
    @SerialName("client_name") val clientName: String,
    @SerialName("redirect_uris") val redirectUris: List<String>,
    @SerialName("token_endpoint_auth_method") val tokenEndpointAuthMethod: String = "none",
    @SerialName("grant_types") val grantTypes: List<String> = listOf("authorization_code", "refresh_token"),
    @SerialName("response_types") val responseTypes: List<String> = listOf("code")
)

/** A client metadata document published at its client_id URL. */
@Serializable
data class ClientMetadataDocument(
    @SerialName("client_id") val clientId: String,
    @SerialName("client_name") val clientName: String? = null,
    @SerialName("redirect_uris") val redirectUris: List<String> = emptyList(),
    @SerialName("token_endpoint_auth_method") val tokenEndpointAuthMethod: String? = null
)

@Serializable
data class TokenResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "Bearer",
    @SerialName("expires_in") val expiresIn: Long,
    @SerialName("refresh_token") val refreshToken: String,
    val scope: String
)

@Serializable
data class OAuthErrorResponse(
    val error: String,
    @SerialName("error_description") val errorDescription: String
)

/** The authorization query the consent page received, forwarded as is. */
@Serializable
data class AuthorizationRequest(
    @SerialName("response_type") val responseType: String? = null,
    @SerialName("client_id") val clientId: String? = null,
    @SerialName("redirect_uri") val redirectUri: String? = null,
    val scope: String? = null,
    val state: String? = null,
    @SerialName("code_challenge") val codeChallenge: String? = null,
    @SerialName("code_challenge_method") val codeChallengeMethod: String? = null,
    val resource: String? = null
)

/** What the consent page shows before the person decides. */
@Serializable
data class AuthorizationPrompt(
    @SerialName("client_name") val clientName: String,
    @SerialName("client_id") val clientId: String,
    /** True when the client proved who it is by serving its metadata from its own domain. */
    val verified: Boolean,
    @SerialName("redirect_host") val redirectHost: String,
    /** The most the client asked for (`read`, `write` or `manage`); the person may allow less. */
    @SerialName("requested_access") val requestedAccess: String
)

/**
 * The consent page's view of a request: either what to ask the person, or —
 * when the request is unusable but its redirect URI is trusted — where to send
 * the browser with the error.
 */
@Serializable
data class AuthorizationCheck(
    val prompt: AuthorizationPrompt? = null,
    @SerialName("redirect_to") val redirectTo: String? = null
)

/** Where to send the browser once the person decided. */
@Serializable
data class AuthorizationRedirect(
    @SerialName("redirect_to") val redirectTo: String
)

@Serializable
data class AuthorizationDecision(
    val request: AuthorizationRequest,
    val approve: Boolean,
    /** What the person allowed: `read` unless they chose more, and never more than was requested. */
    val access: String = "read"
)

/** An agent the person connected through OAuth. */
@Serializable
data class OAuthGrantResponse(
    val id: String,
    @SerialName("client_name") val clientName: String,
    @SerialName("client_id") val clientId: String,
    val verified: Boolean,
    val scope: String,
    @SerialName("last_used_at") val lastUsedAt: String?,
    @SerialName("created_at") val createdAt: String
)

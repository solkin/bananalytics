package com.bananalytics.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class UserResponse(
    val id: String,
    val email: String,
    val name: String?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class AuthResponse(
    val user: UserResponse
)

@Serializable
data class AppAccessResponse(
    val id: String,
    @SerialName("app_id") val appId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("user_email") val userEmail: String,
    @SerialName("user_name") val userName: String?,
    val role: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class GrantAccessRequest(
    val email: String,
    val role: String = "viewer"  // "admin", "viewer", or "tester"
)

@Serializable
data class UpdateAccessRequest(
    val role: String
)

@Serializable
data class ConfigResponse(
    @SerialName("registration_enabled") val registrationEnabled: Boolean,
    @SerialName("smtp_configured") val smtpConfigured: Boolean = false
)

@Serializable
data class InvitationResponse(
    val id: String,
    val email: String,
    @SerialName("app_id") val appId: String,
    val role: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class AccessListItemResponse(
    val id: String,
    @SerialName("app_id") val appId: String,
    @SerialName("user_id") val userId: String?,
    @SerialName("user_email") val userEmail: String,
    @SerialName("user_name") val userName: String?,
    val role: String,
    val status: String,  // "active" or "invited"
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String? = null,
    @SerialName("invite_token") val inviteToken: String? = null
)

@Serializable
data class CheckEmailRequest(
    val email: String
)

@Serializable
data class CheckEmailResponse(
    val exists: Boolean,
    @SerialName("smtp_configured") val smtpConfigured: Boolean
)

package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.models.AccessListItemResponse
import com.bananalytics.models.AppAccessResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.InvitationRepository
import com.bananalytics.repositories.UserRepository
import java.util.UUID

private const val MAX_EMAIL_LENGTH = 254
private val EMAIL_SHAPE = Regex("^[^@\\s]+@[^@\\s]+$")

/**
 * Who belongs to an app. A member is either a person with an account or a
 * pending invitation; both are addressed by the id [list] returns. An app never
 * loses its last admin.
 */
object AccessService {
    val ROLES = listOf("admin", "viewer", "tester")

    /** People with access first, then pending invitations. */
    fun list(appId: UUID): List<AccessListItemResponse> {
        val members = AppAccessRepository.findByAppId(appId).map { it.toListItem() }
        val invitations = InvitationRepository.findByAppId(appId).map {
            invitationItem(it.id, it.appId, it.email, it.role, it.createdAt)
        }
        return members + invitations
    }

    /**
     * Gives [role] to the person with [email] at once when they have an
     * account, and invites them otherwise; the invitation email goes out when
     * SMTP is configured.
     */
    fun grant(appId: UUID, email: String, role: String, invitedBy: UUID): AccessListItemResponse {
        val address = email.trim()
        if (address.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.matches(address)) {
            throw BadRequestException("Enter a valid email address")
        }
        requireRole(role)

        val user = UserRepository.findByEmail(address)
        if (user != null) {
            val userId = UUID.fromString(user.id)
            if (AppAccessRepository.getUserRole(appId, userId) != null) {
                throw BadRequestException("User already has access")
            }
            return AppAccessRepository.grantAccess(appId = appId, userId = userId, role = role).toListItem()
        }

        if (InvitationRepository.findByEmailAndApp(address, appId) != null) {
            throw BadRequestException("Invitation already sent to this email")
        }
        val app = AppRepository.findById(appId) ?: throw NotFoundException("App not found")
        val invitation = InvitationRepository.create(email = address, appId = appId, role = role, invitedBy = invitedBy)
        if (EmailService.isConfigured) {
            EmailService.sendInvitationEmail(
                toEmail = invitation.email,
                appName = app.name,
                role = invitation.role,
                inviteToken = invitation.token
            )
        }
        return invitationItem(
            invitation.id.toString(), invitation.appId.toString(), invitation.email, invitation.role,
            invitation.createdAt.toString()
        )
    }

    fun updateRole(appId: UUID, memberId: UUID, role: String) {
        requireRole(role)
        if (InvitationRepository.updateRole(memberId, appId, role)) return

        if (role != "admin") requireNotLastAdmin(appId, memberId)
        if (!AppAccessRepository.updateRole(appId, memberId, role)) throw NotFoundException("Access not found")
    }

    /** Takes a person's access away, or withdraws an invitation. */
    fun remove(appId: UUID, memberId: UUID) {
        if (InvitationRepository.delete(memberId, appId)) return

        requireNotLastAdmin(appId, memberId)
        if (!AppAccessRepository.revokeAccess(appId, memberId)) throw NotFoundException("Access not found")
    }

    private fun requireRole(role: String) {
        if (role !in ROLES) throw BadRequestException("Role must be 'admin', 'viewer', or 'tester'")
    }

    private fun requireNotLastAdmin(appId: UUID, accessId: UUID) {
        if (AppAccessRepository.getAccessRole(appId, accessId) == "admin" && AppAccessRepository.countAdmins(appId) <= 1) {
            throw BadRequestException("Cannot remove the last admin")
        }
    }

    private fun invitationItem(id: String, appId: String, email: String, role: String, createdAt: String) =
        AccessListItemResponse(
            id = id,
            appId = appId,
            userId = null,
            userEmail = email,
            userName = null,
            role = role,
            status = "invited",
            createdAt = createdAt
        )

    private fun AppAccessResponse.toListItem() = AccessListItemResponse(
        id = id,
        appId = appId,
        userId = userId,
        userEmail = userEmail,
        userName = userName,
        userAvatarUrl = userAvatarUrl,
        role = role,
        status = "active",
        createdAt = createdAt
    )
}

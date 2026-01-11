package com.bananalytics.services

import org.simplejavamail.api.mailer.Mailer
import org.simplejavamail.api.mailer.config.TransportStrategy
import org.simplejavamail.email.EmailBuilder
import org.simplejavamail.mailer.MailerBuilder
import org.slf4j.LoggerFactory

object EmailService {
    private val logger = LoggerFactory.getLogger(EmailService::class.java)

    private val smtpHost: String? = System.getenv("SMTP_HOST")
    private val smtpPort: Int = System.getenv("SMTP_PORT")?.toIntOrNull() ?: 587
    private val smtpUser: String? = System.getenv("SMTP_USER")
    private val smtpPassword: String? = System.getenv("SMTP_PASSWORD")
    private val smtpFrom: String = System.getenv("SMTP_FROM") ?: "noreply@bananalytics.local"
    private val smtpFromName: String = System.getenv("SMTP_FROM_NAME") ?: "Bananalytics"
    private val baseUrl: String = System.getenv("BASE_URL") ?: "http://localhost:5173"

    val isConfigured: Boolean
        get() = !smtpHost.isNullOrBlank() && !smtpUser.isNullOrBlank() && !smtpPassword.isNullOrBlank()

    private val mailer: Mailer? by lazy {
        if (!isConfigured) {
            logger.warn("SMTP is not configured. Email sending is disabled.")
            null
        } else {
            logger.info("Initializing SMTP mailer: $smtpHost:$smtpPort")
            MailerBuilder
                .withSMTPServer(smtpHost, smtpPort, smtpUser, smtpPassword)
                .withTransportStrategy(TransportStrategy.SMTP_TLS)
                .buildMailer()
        }
    }

    fun sendNewVersionEmail(
        toEmail: String,
        appName: String,
        versionName: String?,
        versionCode: Long,
        releaseNotes: String?
    ): Boolean {
        if (mailer == null) {
            logger.warn("Cannot send new version email - SMTP not configured")
            return false
        }

        val versionDisplay = if (versionName != null) "$versionName ($versionCode)" else "Build $versionCode"

        val htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #52c41a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .version-badge { display: inline-block; background: #e6f7ff; color: #1890ff; padding: 8px 16px; border-radius: 4px; font-weight: 600; font-size: 18px; }
                    .release-notes { background: white; border-left: 4px solid #52c41a; padding: 16px; margin: 20px 0; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🍌 New Version Available</h1>
                    </div>
                    <div class="content">
                        <p>A new version of <strong>$appName</strong> is available for testing:</p>
                        <p style="text-align: center;">
                            <span class="version-badge">$versionDisplay</span>
                        </p>
                        ${if (releaseNotes != null) """
                        <div class="release-notes">
                            <strong>Release Notes:</strong>
                            <p>${releaseNotes.replace("\n", "<br>")}</p>
                        </div>
                        """ else ""}
                        <p>Log in to Bananalytics to download the latest build.</p>
                    </div>
                    <div class="footer">
                        <p>You received this email because you have access to $appName on Bananalytics.</p>
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        val textContent = """
            New Version Available for Testing!
            
            A new version of "$appName" is available: $versionDisplay
            ${if (releaseNotes != null) "\nRelease Notes:\n$releaseNotes\n" else ""}
            Log in to Bananalytics to download the latest build.
        """.trimIndent()

        return try {
            val email = EmailBuilder.startingBlank()
                .from(smtpFromName, smtpFrom)
                .to(toEmail)
                .withSubject("New version of $appName available: $versionDisplay")
                .withHTMLText(htmlContent)
                .withPlainText(textContent)
                .buildEmail()

            mailer?.sendMail(email)
            logger.info("New version email sent to $toEmail for $appName $versionDisplay")
            true
        } catch (e: Exception) {
            logger.error("Failed to send new version email to $toEmail", e)
            false
        }
    }

    fun sendInvitationEmail(
        toEmail: String,
        appName: String,
        role: String,
        inviteToken: String
    ): Boolean {
        if (mailer == null) {
            logger.warn("Cannot send invitation email - SMTP not configured")
            return false
        }

        val inviteUrl = "$baseUrl/register?invite=$inviteToken"
        val roleName = when (role) {
            "admin" -> "Administrator"
            "viewer" -> "Viewer"
            "tester" -> "Tester"
            else -> role.replaceFirstChar { it.uppercase() }
        }

        val htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1890ff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                    .role-badge { display: inline-block; background: #e6f7ff; color: #1890ff; padding: 4px 12px; border-radius: 4px; font-weight: 500; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🍌 Bananalytics</h1>
                    </div>
                    <div class="content">
                        <h2>You've been invited!</h2>
                        <p>You have been invited to join <strong>$appName</strong> on Bananalytics as a <span class="role-badge">$roleName</span>.</p>
                        <p>Click the button below to create your account and get access:</p>
                        <p style="text-align: center;">
                            <a href="$inviteUrl" class="button">Accept Invitation</a>
                        </p>
                        <p style="color: #666; font-size: 14px;">Or copy this link: <br><a href="$inviteUrl">$inviteUrl</a></p>
                    </div>
                    <div class="footer">
                        <p>This invitation was sent by Bananalytics. If you didn't expect this email, you can ignore it.</p>
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        val textContent = """
            You've been invited to Bananalytics!
            
            You have been invited to join "$appName" as a $roleName.
            
            Click the link below to create your account and get access:
            $inviteUrl
            
            If you didn't expect this email, you can ignore it.
        """.trimIndent()

        return try {
            val email = EmailBuilder.startingBlank()
                .from(smtpFromName, smtpFrom)
                .to(toEmail)
                .withSubject("You're invited to $appName on Bananalytics")
                .withHTMLText(htmlContent)
                .withPlainText(textContent)
                .buildEmail()

            mailer?.sendMail(email)
            logger.info("Invitation email sent to $toEmail for app $appName")
            true
        } catch (e: Exception) {
            logger.error("Failed to send invitation email to $toEmail", e)
            false
        }
    }
}

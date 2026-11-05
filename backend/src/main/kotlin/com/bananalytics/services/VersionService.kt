package com.bananalytics.services

import com.bananalytics.config.AppConfig
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.models.AppResponse
import com.bananalytics.models.AppVersionResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.DownloadTokenInfo
import com.bananalytics.repositories.DownloadTokenRepository
import com.bananalytics.repositories.VersionRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import java.io.File
import java.util.UUID

private val logger = LoggerFactory.getLogger("VersionService")

/** Roles that hear about a new build. */
private val NOTIFY_ROLES = listOf("admin", "tester")

/** Pause between notification emails, so a big team does not flood SMTP. */
private const val EMAIL_THROTTLE_MS = 500L

/** Versions and the builds people install from them. */
object VersionService {

    /** Longest a public download link may live: a year. */
    const val MAX_LINK_HOURS = 8760

    fun create(appId: UUID, versionCode: Long, versionName: String?, mappingFile: File?): AppVersionResponse {
        if (versionCode <= 0) throw BadRequestException("Version code must be positive")
        if (VersionRepository.findByAppAndVersionCode(appId, versionCode) != null) {
            throw BadRequestException("Version $versionCode already exists")
        }
        return VersionRepository.create(appId = appId, versionCode = versionCode, versionName = versionName, mappingFile = mappingFile)
    }

    /** A link anyone can download the version's APK by until it expires. */
    fun createDownloadLink(appId: UUID, versionId: UUID, expiresInHours: Int): DownloadTokenInfo {
        if (expiresInHours !in 1..MAX_LINK_HOURS) {
            throw BadRequestException("Link lifetime must be between 1 and $MAX_LINK_HOURS hours")
        }
        val (apkPath, _, _) = VersionRepository.getApkInfo(appId, versionId) ?: throw NotFoundException("Version not found")
        if (apkPath == null) throw BadRequestException("No APK uploaded for this version")
        return DownloadTokenRepository.create(appId = appId, versionId = versionId, expiresInHours = expiresInHours)
    }

    fun downloadUrl(token: String): String = "${AppConfig.baseUrl}/api/v1/download/$token"

    /**
     * Emails the app's admins and testers about [version]. Mail being
     * unavailable is not an error here: the returned count says how many
     * messages actually went out.
     */
    suspend fun notifyTeam(appId: UUID, app: AppResponse, version: AppVersionResponse): Int {
        if (!EmailService.isConfigured) {
            logger.warn("SMTP is not configured — version {} published without notifying", version.versionCode)
            return 0
        }

        val recipients = dbIO { AppAccessRepository.findEmailsByRoles(appId, NOTIFY_ROLES) }
        var sent = 0

        recipients.forEachIndexed { index, email ->
            // SMTP is blocking, so it does not belong on a request thread.
            val delivered = withContext(Dispatchers.IO) {
                EmailService.sendNewVersionEmail(
                    toEmail = email,
                    appId = appId.toString(),
                    appName = app.name,
                    versionName = version.versionName,
                    versionCode = version.versionCode,
                    releaseNotes = version.releaseNotes
                )
            }
            if (delivered) sent++
            if (index < recipients.size - 1) delay(EMAIL_THROTTLE_MS)
        }

        return sent
    }
}

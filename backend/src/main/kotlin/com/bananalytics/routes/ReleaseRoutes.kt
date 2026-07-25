package com.bananalytics.routes

import com.bananalytics.config.AppConfig
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.PayloadTooLargeException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.config.dbIO
import com.bananalytics.models.AppResponse
import com.bananalytics.models.AppVersionResponse
import com.bananalytics.models.PublishReleaseResponse
import com.bananalytics.repositories.ApiKeyRepository
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.DownloadTokenRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.ApkManifestParser
import com.bananalytics.services.EmailService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.*

private val logger = LoggerFactory.getLogger("ReleaseRoutes")

private const val COPY_BUFFER_SIZE = 64 * 1024
private const val DEFAULT_LINK_HOURS = 720 // 30 days
private const val MAX_LINK_HOURS = 8760 // a year

/** Roles that hear about a new build when `notify=true`. */
private val NOTIFY_ROLES = listOf("admin", "tester")

/** Pause between notification emails, same as the UI's notify dialog uses. */
private const val EMAIL_THROTTLE_MS = 500L

/**
 * Publishing a build from CI, in one request: the APK carries its own package
 * and version, so a pipeline only has to hand over the file and gets back a
 * download link. Authenticated by an `upload`-scoped API key, which — unlike the
 * SDK key — never ships inside an app.
 */
fun Route.releaseRoutes() {
    post("/releases") {
        val app = call.authenticateUploadKey()
        val apkLimit = AppConfig.maxApkBytes

        // Nothing in one request should be able to fill the disk: the APK and the
        // mapping are each capped, and the body as a whole gets a rough ceiling
        // so an absurd upload is refused before we read any of it.
        call.request.header(HttpHeaders.ContentLength)?.toLongOrNull()?.let { declared ->
            if (declared > apkLimit * 2) {
                throw PayloadTooLargeException("Request body is larger than ${mb(apkLimit * 2)} MB")
            }
        }

        var apkFile: File? = null
        var apkFilename = "app.apk"
        var apkSize = 0L
        var mappingContent: String? = null
        var formVersionCode: Long? = null
        var formVersionName: String? = null
        var releaseNotes: String? = null
        var publish = true
        var notify = false
        var linkHours = DEFAULT_LINK_HOURS

        try {
            call.receiveMultipart().forEachPart { part ->
                try {
                    when (part) {
                        is PartData.FormItem -> when (part.name) {
                            "version_code" -> formVersionCode = part.value.trim().toLongOrNull()
                                ?: throw BadRequestException("version_code must be a number")
                            "version_name" -> formVersionName = part.value.trim().takeIf { it.isNotBlank() }
                            "release_notes" -> releaseNotes = part.value.takeIf { it.isNotBlank() }
                            "publish" -> publish = part.value.toFlag("publish")
                            "notify" -> notify = part.value.toFlag("notify")
                            "link_expires_in_hours" -> linkHours = part.value.trim().toIntOrNull()
                                ?: throw BadRequestException("link_expires_in_hours must be a number")
                            else -> {}
                        }

                        is PartData.FileItem -> when (part.name) {
                            "apk" -> {
                                // A second apk part would orphan the first temp file.
                                if (apkFile != null) {
                                    throw BadRequestException("Only one apk part is allowed")
                                }
                                apkFilename = part.originalFileName.toSafeFilename()
                                val target = File.createTempFile("bananalytics-release-", ".apk")
                                apkFile = target
                                apkSize = part.provider().copyToFile(target, apkLimit, "APK")
                            }
                            "mapping" -> mappingContent = part.provider()
                                .readText(apkLimit, "Mapping file")
                                .takeIf { it.isNotBlank() }
                            else -> {}
                        }

                        else -> {}
                    }
                } finally {
                    part.dispose()
                }
            }

            val apk = apkFile ?: throw BadRequestException("apk file part is required")
            val explicitVersionCode = formVersionCode
            if (apkSize == 0L) {
                throw BadRequestException("apk file is empty")
            }
            if (explicitVersionCode != null && explicitVersionCode <= 0) {
                throw BadRequestException("version_code must be positive")
            }
            if (linkHours !in 1..MAX_LINK_HOURS) {
                throw BadRequestException("link_expires_in_hours must be between 1 and $MAX_LINK_HOURS")
            }

            val manifest = ApkManifestParser.read(apk)
                ?: throw BadRequestException("Could not read AndroidManifest.xml — is this a valid APK?")

            if (manifest.packageName != app.packageName) {
                throw BadRequestException(
                    "Package name mismatch: APK is ${manifest.packageName}, app is ${app.packageName}"
                )
            }

            val versionCode = explicitVersionCode
                ?: manifest.versionCode
                ?: throw BadRequestException("APK has no versionCode — pass version_code explicitly")
            // A versionName written as @string/… is a resource reference the
            // manifest alone cannot resolve, hence the explicit override.
            val versionName = formVersionName ?: manifest.versionName

            val appId = UUID.fromString(app.id)
            val version = dbIO {
                VersionRepository.upsertRelease(
                    appId = appId,
                    versionCode = versionCode,
                    versionName = versionName,
                    apkFile = apk,
                    apkFilename = apkFilename,
                    mappingContent = mappingContent,
                    releaseNotes = releaseNotes,
                    publishForTesters = publish
                )
            }

            val downloadToken = dbIO {
                DownloadTokenRepository.create(appId, UUID.fromString(version.id), linkHours)
            }
            val notified = if (notify) notifyTeam(appId, app, version) else 0

            logger.info(
                "Published release {} ({}) for app {}: {} bytes, mapping={}, published={}, notified={}",
                versionCode, versionName ?: "-", app.packageName, apkSize, mappingContent != null, publish, notified
            )

            call.respond(
                HttpStatusCode.Created,
                PublishReleaseResponse(
                    appId = app.id,
                    versionId = version.id,
                    versionCode = version.versionCode,
                    versionName = version.versionName,
                    releaseNotes = version.releaseNotes,
                    publishedForTesters = version.publishedForTesters,
                    hasMapping = version.hasMapping,
                    apkSize = apkSize,
                    downloadUrl = "${AppConfig.baseUrl}/api/v1/download/${downloadToken.token}",
                    expiresAt = downloadToken.expiresAt.toString(),
                    notified = notified
                )
            )
        } finally {
            apkFile?.delete()
        }
    }
}

/**
 * Notifies admins and testers. A publish that succeeded is not turned into an
 * error just because mail is unavailable — the count in the response tells the
 * caller what actually went out.
 */
private suspend fun notifyTeam(appId: UUID, app: AppResponse, version: AppVersionResponse): Int {
    if (!EmailService.isConfigured) {
        logger.warn("notify=true but SMTP is not configured — published {} without notifying", version.versionCode)
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

/** Streams a part to disk, refusing it the moment it outgrows the limit. */
private suspend fun ByteReadChannel.copyToFile(target: File, limit: Long, what: String): Long =
    withContext(Dispatchers.IO) {
        var total = 0L
        val buffer = ByteArray(COPY_BUFFER_SIZE)
        target.outputStream().buffered().use { out ->
            while (!isClosedForRead) {
                val read = readAvailable(buffer)
                if (read <= 0) break
                total += read
                if (total > limit) {
                    throw PayloadTooLargeException("$what exceeds the ${mb(limit)} MB limit")
                }
                out.write(buffer, 0, read)
            }
        }
        total
    }

private suspend fun ByteReadChannel.readText(limit: Long, what: String): String {
    val collected = ByteArrayOutputStream()
    val buffer = ByteArray(COPY_BUFFER_SIZE)
    while (!isClosedForRead) {
        val read = readAvailable(buffer)
        if (read <= 0) break
        if (collected.size() + read > limit) {
            throw PayloadTooLargeException("$what exceeds the ${mb(limit)} MB limit")
        }
        collected.write(buffer, 0, read)
    }
    return collected.toString(Charsets.UTF_8)
}

private fun mb(bytes: Long): Long = bytes / (1024 * 1024)

/**
 * The name a CI job sends is echoed back in `Content-Disposition` when a tester
 * downloads the build, so it is reduced to a plain basename first.
 */
private fun String?.toSafeFilename(): String {
    val basename = this?.substringAfterLast('/')?.substringAfterLast('\\').orEmpty()
    val cleaned = basename.filter { it.isLetterOrDigit() || it in "._- " }.trim().take(200)
    return cleaned.ifBlank { "app.apk" }
}

private fun String.toFlag(field: String): Boolean = when (trim().lowercase()) {
    "true", "1", "yes", "on" -> true
    "false", "0", "no", "off" -> false
    else -> throw BadRequestException("$field must be true or false")
}

private fun ApplicationCall.authenticateUploadKey(): AppResponse {
    val apiKey = request.header("X-API-Key")
        ?: throw UnauthorizedException("Missing X-API-Key header")

    return ApiKeyRepository.authenticate(apiKey, ApiKeyRepository.SCOPE_UPLOAD)
        ?: throw UnauthorizedException("Invalid API key, or the key cannot publish releases")
}

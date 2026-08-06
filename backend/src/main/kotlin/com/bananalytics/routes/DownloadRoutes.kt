package com.bananalytics.routes

import com.bananalytics.config.NotFoundException
import com.bananalytics.repositories.DownloadTokenRepository
import com.bananalytics.repositories.VersionRepository
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.util.*

private val APK_CONTENT_TYPE = ContentType.parse("application/vnd.android.package-archive")

fun Route.downloadRoutes() {
    // Public download via token (no authentication required)
    get("/download/{token}") {
        val token = call.parameters["token"]
            ?: throw NotFoundException("Invalid token")

        val tokenInfo = DownloadTokenRepository.findValidByToken(token)
            ?: throw NotFoundException("Invalid or expired download link")

        call.respondApk(tokenInfo.versionId)
    }
}

/**
 * Serves a version's APK straight from storage. A build runs to tens of
 * megabytes, so it is streamed rather than read into memory — otherwise every
 * concurrent tester download would cost another copy of it in heap.
 */
internal suspend fun ApplicationCall.respondApk(versionId: UUID) {
    val apkInfo = VersionRepository.getApkInfo(versionId)
        ?: throw NotFoundException("Version not found")
    if (apkInfo.first == null) {
        throw NotFoundException("APK not found")
    }

    val stream = VersionRepository.openApk(versionId)
        ?: throw NotFoundException("APK not found")

    response.header(
        HttpHeaders.ContentDisposition,
        ContentDisposition.Attachment.withParameter(
            ContentDisposition.Parameters.FileName,
            apkInfo.third ?: "app.apk"
        ).toString()
    )
    respondOutputStream(APK_CONTENT_TYPE, contentLength = apkInfo.second) {
        val out = this
        withContext(Dispatchers.IO) { stream.use { it.copyTo(out) } }
    }
}

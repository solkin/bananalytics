package com.bananalytics.routes

import com.bananalytics.config.NotFoundException
import com.bananalytics.repositories.DownloadTokenRepository
import com.bananalytics.repositories.VersionRepository
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.downloadRoutes() {
    // Public download via token (no authentication required)
    get("/download/{token}") {
        val token = call.parameters["token"]
            ?: throw NotFoundException("Invalid token")

        val tokenInfo = DownloadTokenRepository.findValidByToken(token)
            ?: throw NotFoundException("Invalid or expired download link")

        val apkInfo = VersionRepository.getApkInfo(tokenInfo.versionId)
        if (apkInfo?.first == null) {
            throw NotFoundException("APK not found")
        }

        val apkContent = VersionRepository.getApkContent(tokenInfo.versionId)
            ?: throw NotFoundException("APK not found")

        val filename = apkInfo.third ?: "app.apk"

        call.response.header(
            HttpHeaders.ContentDisposition,
            ContentDisposition.Attachment.withParameter(
                ContentDisposition.Parameters.FileName,
                filename
            ).toString()
        )
        call.respondBytes(apkContent, ContentType.parse("application/vnd.android.package-archive"))
    }
}

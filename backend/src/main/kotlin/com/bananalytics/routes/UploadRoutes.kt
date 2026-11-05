package com.bananalytics.routes

import com.bananalytics.config.AppConfig
import com.bananalytics.config.AppPermissions
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.config.bearerToken
import com.bananalytics.config.dbIO
import com.bananalytics.models.AppVersionResponse
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.UploadGrant
import com.bananalytics.repositories.UploadKind
import com.bananalytics.repositories.UploadTokenRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.ApkManifestParser
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

/**
 * Where agents upload files. An agent gets an upload token over MCP and PUTs
 * one file as the request body (`curl -T`), so the file never passes through
 * the model. The token rides in `Authorization` rather than in the URL, which
 * keeps it out of access logs. The upload acts for the person who created it.
 */
fun Route.uploadRoutes() {
    put("/uploads") {
        val token = call.request.bearerToken() ?: throw UnauthorizedException("Upload token required")
        val grant = dbIO { UploadTokenRepository.claim(token) }
            ?: throw UnauthorizedException("Upload token is invalid, expired or already used; request a new one")
        // A token outlives nothing: its maker must still be an admin when it is used.
        AppPermissions.requireAdmin(grant.appId, grant.createdBy)

        val version = when (grant.kind) {
            UploadKind.MAPPING -> call.uploadMapping(grant)
            UploadKind.APK -> call.uploadApk(grant)
        }
        call.respond(version)
    }
}

private suspend fun ApplicationCall.uploadMapping(grant: UploadGrant): AppVersionResponse {
    val mapping = receiveBodyFile(AppConfig.maxApkBytes, "Mapping file", ".tmp").toStoredMapping()
        ?: throw BadRequestException("Mapping file is empty")
    try {
        if (!dbIO { VersionRepository.updateMapping(grant.appId, grant.versionId, mapping) }) {
            throw NotFoundException("Version not found")
        }
    } finally {
        mapping.delete()
    }
    return dbIO { VersionRepository.findById(grant.appId, grant.versionId) } ?: throw NotFoundException("Version not found")
}

/** The APK must be a build of this app and, when its manifest says, of this version. */
private suspend fun ApplicationCall.uploadApk(grant: UploadGrant): AppVersionResponse {
    val apk = receiveBodyFile(AppConfig.maxApkBytes, "APK", ".apk")
    try {
        if (apk.length() == 0L) throw BadRequestException("APK file is empty")
        val app = dbIO { AppRepository.findById(grant.appId) } ?: throw NotFoundException("App not found")
        val version = dbIO { VersionRepository.findById(grant.appId, grant.versionId) }
            ?: throw NotFoundException("Version not found")

        val manifest = dbIO { ApkManifestParser.read(apk) }
            ?: throw BadRequestException("Could not read AndroidManifest.xml — is this a valid APK?")
        if (manifest.packageName != app.packageName) {
            throw BadRequestException("Package name mismatch: APK is ${manifest.packageName}, app is ${app.packageName}")
        }
        if (manifest.versionCode != null && manifest.versionCode != version.versionCode) {
            throw BadRequestException("Version code mismatch: APK is ${manifest.versionCode}, the token is for ${version.versionCode}")
        }

        val filename = "${app.packageName}-${version.versionCode}.apk"
        if (!dbIO { VersionRepository.uploadApk(grant.appId, grant.versionId, apk, filename) }) {
            throw NotFoundException("Version not found")
        }
    } finally {
        apk.delete()
    }
    return dbIO { VersionRepository.findById(grant.appId, grant.versionId) } ?: throw NotFoundException("Version not found")
}

package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.models.*
import com.bananalytics.repositories.AppSessionRepository
import org.jetbrains.exposed.sql.transactions.transaction
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.repositories.VersionRepository
import java.util.*

object CrashService {

    fun processCrashes(
        appId: UUID,
        environment: EnvironmentData,
        crashes: List<CrashData>,
        sessionId: String? = null
    ): Int {
        environment.validate()
        val session = sessionId?.parseUuid("session_id")
        crashes.forEach {
            if (it.thread.length > MAX_CRASH_THREAD_LENGTH) throw BadRequestException("Crash thread must be at most $MAX_CRASH_THREAD_LENGTH characters")
            if (it.stacktrace.isBlank()) throw BadRequestException("Crash stacktrace must not be empty")
            it.reportId?.parseUuid("report_id")
        }
        if (crashes.isEmpty()) return 0
        val version = VersionRepository.findByAppAndVersionCode(appId, environment.appVersion)
        if (version?.muteCrashes == true) return 0
        val mappingPath = VersionRepository.getMappingPath(appId, environment.appVersion)
        val decoded = mappingPath?.let { RetraceService.retraceBatch(it, crashes.map { crash -> crash.stacktrace }) }
        val deviceInfo = environment.deviceInfo()
        return transaction {
            val currentVersion = VersionRepository.findOrCreate(appId, environment.appVersion, environment.appVersionName)
            if (currentVersion.muteCrashes) return@transaction 0
            crashes.forEachIndexed { index, crash ->
                val result = decoded?.get(index)
                CrashRepository.createCrash(appId, UUID.fromString(currentVersion.id), environment.appVersion,
                    crash, deviceInfo, result?.decodedStacktrace, result?.error)
            }
            if (session != null) {
                AppSessionRepository.recordSession(appId, session, environment.appVersion,
                    environment.deviceId, hasCrash = true, deviceInfo = deviceInfo)
            }
            crashes.size
        }
    }

    fun retraceCrash(crashId: UUID): CrashResponse {
        val crash = CrashRepository.findCrashById(crashId)
            ?: throw NotFoundException("Crash not found")

        val versionCode = crash.versionCode
            ?: throw NotFoundException("Crash has no version code")

        val appId = UUID.fromString(crash.appId)
        val mappingPath = VersionRepository.getMappingPath(appId, versionCode)
            ?: throw NotFoundException("No mapping found for version $versionCode")

        val result = RetraceService.retraceBatch(mappingPath, listOf(crash.stacktraceRaw)).single()
        CrashRepository.updateDecodedStacktrace(crashId, result.decodedStacktrace, result.error)

        return CrashRepository.findCrashById(crashId)
            ?: throw NotFoundException("Crash not found after update")
    }
}

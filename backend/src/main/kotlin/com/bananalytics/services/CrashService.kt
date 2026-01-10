package com.bananalytics.services

import com.bananalytics.config.NotFoundException
import com.bananalytics.models.*
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.repositories.VersionRepository
import java.util.*

object CrashService {

    fun processCrashes(
        appId: UUID,
        environment: EnvironmentData,
        crashes: List<CrashData>
    ): Int {
        val versionCode = environment.appVersion
        val versionName = environment.appVersionName
        
        // Auto-create version if it doesn't exist
        val version = VersionRepository.findOrCreate(appId, versionCode, versionName)
        
        // Check if crashes are muted for this version
        if (version.muteCrashes) {
            return 0 // Silently ignore, return success
        }
        
        val mappingContent = VersionRepository.getMappingContent(appId, versionCode)

        val deviceInfo = DeviceInfo(
            deviceId = environment.deviceId,
            osVersion = environment.osVersion,
            manufacturer = environment.manufacturer,
            model = environment.model,
            country = environment.country,
            language = environment.language
        )

        var count = 0
        for (crash in crashes) {
            val (decoded, error) = if (mappingContent != null) {
                RetraceService.retrace(crash.stacktrace, mappingContent)
            } else {
                RetraceService.RetraceResult(null, null)
            }

            CrashRepository.createCrash(
                appId = appId,
                versionId = UUID.fromString(version.id),
                versionCode = versionCode,
                crash = crash,
                deviceInfo = deviceInfo,
                decodedStacktrace = decoded,
                decodeError = error
            )
            count++
        }

        return count
    }

    fun retraceCrash(crashId: UUID): CrashResponse {
        val crash = CrashRepository.findCrashById(crashId)
            ?: throw NotFoundException("Crash not found")

        val versionCode = crash.versionCode
            ?: throw NotFoundException("Crash has no version code")

        val appId = UUID.fromString(crash.appId)
        val mappingContent = VersionRepository.getMappingContent(appId, versionCode)
            ?: throw NotFoundException("No mapping found for version $versionCode")

        val result = RetraceService.retrace(crash.stacktraceRaw, mappingContent)
        CrashRepository.updateDecodedStacktrace(crashId, result.decodedStacktrace, result.error)

        return CrashRepository.findCrashById(crashId)
            ?: throw NotFoundException("Crash not found after update")
    }
}

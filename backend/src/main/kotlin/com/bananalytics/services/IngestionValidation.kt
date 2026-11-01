package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.models.DeviceInfo
import com.bananalytics.models.EnvironmentData
import java.util.UUID

internal const val MAX_DEVICE_ID_LENGTH = 64
internal const val MAX_VERSION_NAME_LENGTH = 50
internal const val MAX_CRASH_THREAD_LENGTH = 100
internal const val MAX_EVENT_NAME_LENGTH = 255

internal fun EnvironmentData.validate() {
    if (deviceId.length > MAX_DEVICE_ID_LENGTH) throw BadRequestException("device_id must be at most $MAX_DEVICE_ID_LENGTH characters")
    if (appVersionName != null && appVersionName.length > MAX_VERSION_NAME_LENGTH) {
        throw BadRequestException("app_version_name must be at most $MAX_VERSION_NAME_LENGTH characters")
    }
}

internal fun EnvironmentData.deviceInfo() = DeviceInfo(deviceId, osVersion, manufacturer, model, country, language)

internal fun String.parseUuid(field: String): UUID = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    throw BadRequestException("$field must be a UUID")
}

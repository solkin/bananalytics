package com.bananalytics.services

import com.bananalytics.models.DeviceInfo
import com.bananalytics.models.EnvironmentData
import com.bananalytics.models.EventData
import com.bananalytics.repositories.EventRepository
import com.bananalytics.repositories.VersionRepository
import java.util.*

object EventService {

    fun processEvents(
        appId: UUID,
        environment: EnvironmentData,
        events: List<EventData>
    ): Int {
        val versionCode = environment.appVersion
        val versionName = environment.appVersionName
        
        // Auto-create version if it doesn't exist
        VersionRepository.findOrCreate(appId, versionCode, versionName)

        val deviceInfo = DeviceInfo(
            deviceId = environment.deviceId,
            osVersion = environment.osVersion,
            manufacturer = environment.manufacturer,
            model = environment.model,
            country = environment.country,
            language = environment.language
        )

        return EventRepository.createEvents(
            appId = appId,
            versionCode = versionCode,
            events = events,
            deviceInfo = deviceInfo
        )
    }
}

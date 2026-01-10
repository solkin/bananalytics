package com.bananalytics.services

import com.bananalytics.models.DeviceInfo
import com.bananalytics.models.EnvironmentData
import com.bananalytics.models.EventData
import com.bananalytics.repositories.EventRepository
import java.util.*

object EventService {

    fun processEvents(
        appId: UUID,
        environment: EnvironmentData,
        events: List<EventData>
    ): Int {
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
            versionCode = environment.appVersion,
            events = events,
            deviceInfo = deviceInfo
        )
    }
}

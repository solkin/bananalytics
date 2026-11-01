package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.models.EnvironmentData
import com.bananalytics.models.EventData
import com.bananalytics.repositories.AppSessionRepository
import com.bananalytics.repositories.EventRepository
import com.bananalytics.repositories.VersionRepository
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.UUID

object EventService {
    fun processEvents(
        appId: UUID,
        environment: EnvironmentData,
        events: List<EventData>,
        sessionId: String? = null
    ): Int {
        environment.validate()
        if (events.any { it.name.isBlank() || it.name.length > MAX_EVENT_NAME_LENGTH }) {
            throw BadRequestException("Event names must contain between 1 and $MAX_EVENT_NAME_LENGTH characters")
        }
        val session = sessionId?.parseUuid("session_id")
        if (events.isEmpty()) return 0
        val deviceInfo = environment.deviceInfo()
        return transaction {
            val version = VersionRepository.findOrCreate(appId, environment.appVersion, environment.appVersionName)
            if (version.muteEvents) return@transaction 0
            val inserted = EventRepository.createEvents(appId, environment.appVersion, events, deviceInfo)
            if (session != null) {
                AppSessionRepository.recordSession(appId, session, environment.appVersion,
                    environment.deviceId, hasEvent = true, deviceInfo = deviceInfo)
            }
            inserted
        }
    }
}

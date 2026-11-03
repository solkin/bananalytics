package com.bananalytics.repositories

import com.bananalytics.models.OAuthClients
import com.bananalytics.models.OAuthGrants
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

data class OAuthClient(
    val id: UUID,
    val clientId: String,
    val name: String,
    val redirectUris: List<String>,
    /** Identified by the URL of a metadata document it serves itself. */
    val verified: Boolean
)

/** Agent products allowed to ask people for access to their data. */
object OAuthClientRepository {
    const val KIND_REGISTERED = "registered"
    const val KIND_METADATA = "metadata"

    private const val CLIENT_ID_PREFIX = "bnc_"

    /** A registration nobody completed authorization with is dropped after this. */
    private const val UNUSED_REGISTRATION_DAYS = 7L

    fun findByClientId(clientId: String): OAuthClient? = transaction {
        OAuthClients.selectAll().where { OAuthClients.clientId eq clientId }.singleOrNull()?.toClient()
    }

    /** Dynamic registration (RFC 7591): anyone may register, so stale ones are swept here. */
    fun register(name: String, redirectUris: List<String>): OAuthClient = transaction {
        val cutoff = OffsetDateTime.now().minusDays(UNUSED_REGISTRATION_DAYS)
        OAuthClients.deleteWhere {
            (kind eq KIND_REGISTERED) and (createdAt less cutoff) and
                notExists(OAuthGrants.selectAll().where { OAuthGrants.clientId eq OAuthClients.id })
        }

        val clientId = Secrets.generate(CLIENT_ID_PREFIX)
        val id = OAuthClients.insertAndGetId {
            it[OAuthClients.clientId] = clientId
            it[clientName] = name
            it[OAuthClients.redirectUris] = redirectUris
            it[kind] = KIND_REGISTERED
            it[createdAt] = OffsetDateTime.now()
        }
        OAuthClient(id.value, clientId, name, redirectUris, verified = false)
    }

    /** Records what a client's metadata document currently says. */
    fun upsertFromMetadata(clientId: String, name: String, redirectUris: List<String>): OAuthClient = transaction {
        // Concurrent authorizations of one client race here, hence an upsert.
        OAuthClients.upsert(
            OAuthClients.clientId,
            onUpdateExclude = listOf(OAuthClients.id, OAuthClients.kind, OAuthClients.createdAt)
        ) {
            it[OAuthClients.clientId] = clientId
            it[clientName] = name
            it[OAuthClients.redirectUris] = redirectUris
            it[kind] = KIND_METADATA
            it[createdAt] = OffsetDateTime.now()
        }
        OAuthClients.selectAll().where { OAuthClients.clientId eq clientId }.single().toClient()
    }

    internal fun ResultRow.toClient() = OAuthClient(
        id = this[OAuthClients.id].value,
        clientId = this[OAuthClients.clientId],
        name = this[OAuthClients.clientName],
        redirectUris = this[OAuthClients.redirectUris],
        verified = this[OAuthClients.kind] == KIND_METADATA
    )
}

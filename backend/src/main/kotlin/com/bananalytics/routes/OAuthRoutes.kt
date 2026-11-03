package com.bananalytics.routes

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.OAuthException
import com.bananalytics.config.dbIO
import com.bananalytics.config.getUser
import com.bananalytics.config.toUUIDOrNull
import com.bananalytics.models.AuthorizationDecision
import com.bananalytics.models.AuthorizationRequest
import com.bananalytics.models.ClientRegistrationRequest
import com.bananalytics.repositories.OAuthGrantRepository
import com.bananalytics.services.OAuthService
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

/** Discovery documents. They live at the origin, outside the API prefix. */
fun Route.oauthDiscoveryRoutes(oauth: OAuthService) {
    route("/.well-known") {
        // RFC 9728 inserts the resource path; some clients ask at the root instead.
        get("/oauth-protected-resource/mcp") { call.respond(oauth.protectedResourceMetadata) }
        get("/oauth-protected-resource") { call.respond(oauth.protectedResourceMetadata) }
        get("/oauth-authorization-server") { call.respond(oauth.authorizationServerMetadata) }
    }
}

/** The endpoints an OAuth client calls itself, without a person's session. */
fun Route.oauthClientRoutes(oauth: OAuthService) {
    route("/oauth") {
        post("/register") {
            call.noStore()
            val request = try {
                call.receive<ClientRegistrationRequest>()
            } catch (e: io.ktor.server.plugins.BadRequestException) {
                throw OAuthException("invalid_client_metadata", "The registration request is not valid JSON")
            }
            call.respond(HttpStatusCode.Created, oauth.register(request))
        }
        post("/token") {
            call.noStore()
            call.respond(oauth.token(call.receiveParameters()))
        }
        post("/revoke") {
            oauth.revoke(call.receiveParameters())
            call.respond(HttpStatusCode.OK)
        }
    }
}

/** The consent page and the person's list of connected clients. */
fun Route.oauthConsentRoutes(oauth: OAuthService) {
    route("/oauth") {
        post("/authorize/check") {
            call.respond(oauth.check(call.receive<AuthorizationRequest>()))
        }
        post("/authorize") {
            val userId = UUID.fromString(call.getUser().id)
            call.respond(oauth.decide(userId, call.receive<AuthorizationDecision>()))
        }
        get("/grants") {
            val userId = UUID.fromString(call.getUser().id)
            call.respond(dbIO { OAuthGrantRepository.findByUserId(userId) })
        }
        delete("/grants/{grantId}") {
            val userId = UUID.fromString(call.getUser().id)
            val grantId = call.parameters["grantId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid grant ID")
            if (!dbIO { OAuthGrantRepository.delete(userId, grantId) }) {
                throw NotFoundException("Connection not found")
            }
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

/** Token responses must not be cached anywhere (RFC 6749 §5.1). */
private fun ApplicationCall.noStore() {
    response.header(HttpHeaders.CacheControl, "no-store")
    response.header(HttpHeaders.Pragma, "no-cache")
}

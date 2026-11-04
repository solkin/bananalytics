package com.bananalytics

import com.bananalytics.config.configureDatabase
import com.bananalytics.config.configureRouting
import com.bananalytics.config.configureSerialization
import com.bananalytics.config.configureStatusPages
import com.bananalytics.config.configureStorage
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

/**
 * The JDK refuses Basic credentials for HTTPS proxy tunnels unless this is
 * cleared, and reads it only once, so it is set before anything else runs.
 * An outbound proxy (see AppConfig.outboundProxy) authenticates this way.
 */
const val ALLOW_PROXY_TUNNEL_BASIC_AUTH = "jdk.http.auth.tunneling.disabledSchemes"

fun main() {
    System.setProperty(ALLOW_PROXY_TUNNEL_BASIC_AUTH, "")
    val port = System.getenv("SERVER_PORT")?.toIntOrNull() ?: 8080
    
    embeddedServer(Netty, port = port, host = "0.0.0.0") {
        module()
    }.start(wait = true)
}

fun Application.module() {
    configureDatabase()
    configureStorage()
    configureSerialization()
    configureStatusPages()
    configureRouting()
}

package com.bananalytics

import com.bananalytics.config.configureDatabase
import com.bananalytics.config.configureRouting
import com.bananalytics.config.configureSerialization
import com.bananalytics.config.configureStatusPages
import com.bananalytics.config.configureStorage
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
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

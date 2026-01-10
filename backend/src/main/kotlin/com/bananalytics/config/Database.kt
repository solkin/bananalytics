package com.bananalytics.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.jetbrains.exposed.sql.Database

fun Application.configureDatabase() {
    val url = System.getenv("DATABASE_URL") 
        ?: "jdbc:postgresql://localhost:5432/bananalytics"
    val user = System.getenv("DATABASE_USER") ?: "bananalytics"
    val password = System.getenv("DATABASE_PASSWORD") ?: "bananalytics_dev"

    val config = HikariConfig().apply {
        jdbcUrl = url
        username = user
        this.password = password
        driverClassName = "org.postgresql.Driver"
        maximumPoolSize = 10
        isAutoCommit = false
        transactionIsolation = "TRANSACTION_READ_COMMITTED"
        validate()
    }

    Database.connect(HikariDataSource(config))
}

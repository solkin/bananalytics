package com.bananalytics.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.io.File
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val logger = LoggerFactory.getLogger("Database")

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

    runMigrations()
    ensureEventPartitions()
}

/**
 * Self-healing partition maintenance for the month-partitioned `events` table.
 * Runs on every startup: ensures named monthly partitions for the recent past
 * and near future, plus a DEFAULT catch-all so event ingestion never fails for
 * a date with no explicit partition. Idempotent.
 */
private fun ensureEventPartitions() {
    val fmt = DateTimeFormatter.ofPattern("yyyy_MM")
    // `created_at` is TIMESTAMPTZ, so a bare date in a bound would be read in
    // the session's timezone: east of UTC the new month starts before the last
    // one ends, and Postgres rejects it as an overlap. Anchor both to UTC.
    val firstOfMonth = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1)

    for (i in -1..3) {
        val start = firstOfMonth.plusMonths(i.toLong())
        val name = "events_" + start.format(fmt)
        createPartition(name) {
            "CREATE TABLE $name PARTITION OF events " +
                "FOR VALUES FROM ('$start 00:00:00+00') TO ('${start.plusMonths(1)} 00:00:00+00')"
        }
    }
    createPartition("events_default") { "CREATE TABLE events_default PARTITION OF events DEFAULT" }

    logger.info("Event partitions ensured")
}

/**
 * One transaction per partition: a failed statement aborts the whole Postgres
 * transaction, so sharing one would turn a single skipped partition into a
 * failed startup.
 */
private fun createPartition(name: String, sql: () -> String) {
    try {
        transaction {
            if (!tableExists(name)) exec(sql())
        }
    } catch (e: Exception) {
        logger.warn("Skipped event partition $name: ${e.message}")
    }
}

private fun org.jetbrains.exposed.sql.Transaction.tableExists(name: String): Boolean =
    exec("SELECT 1 FROM pg_tables WHERE tablename = '$name'") { it.next() } ?: false

private fun runMigrations() {
    transaction {
        // Create migrations tracking table if not exists
        exec("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(50) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """.trimIndent())
        
        // Get list of applied migrations
        val appliedMigrations = mutableSetOf<String>()
        exec("SELECT version FROM schema_migrations") { rs ->
            while (rs.next()) {
                appliedMigrations.add(rs.getString("version"))
            }
        }
        
        // Find and run pending migrations from classpath
        val migrationsPath = "db/migrations"
        val classLoader = Thread.currentThread().contextClassLoader
        val migrationsUrl = classLoader.getResource(migrationsPath)
        
        val migrationFiles = if (migrationsUrl != null) {
            when (migrationsUrl.protocol) {
                "file" -> File(migrationsUrl.toURI()).listFiles()
                    ?.filter { it.name.endsWith(".sql") }
                    ?.sortedBy { it.name }
                    ?.map { it.name to it.readText() }
                    ?: emptyList()
                "jar" -> {
                    // Read from JAR using classloader
                    val jarPath = migrationsUrl.path.substringBefore("!")
                    val jar = java.util.jar.JarFile(File(java.net.URI(jarPath)))
                    jar.entries().asSequence()
                        .filter { it.name.startsWith(migrationsPath) && it.name.endsWith(".sql") }
                        .map { entry ->
                            val name = entry.name.substringAfterLast("/")
                            val content = jar.getInputStream(entry).bufferedReader().readText()
                            name to content
                        }
                        .sortedBy { it.first }
                        .toList()
                }
                else -> emptyList()
            }
        } else {
            emptyList()
        }
        
        // Apply pending migrations
        for ((filename, sql) in migrationFiles) {
            val version = filename.removeSuffix(".sql")
            if (version !in appliedMigrations) {
                logger.info("Applying migration: $filename")
                try {
                    exec(sql)
                    exec("INSERT INTO schema_migrations (version) VALUES ('$version')")
                    logger.info("Migration applied successfully: $filename")
                } catch (e: Exception) {
                    logger.error("Failed to apply migration $filename: ${e.message}")
                    throw e
                }
            }
        }
    }
}

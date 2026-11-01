package com.bananalytics.support

import com.bananalytics.config.*
import com.bananalytics.repositories.*
import io.ktor.server.testing.ApplicationTestBuilder
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.Assume.assumeNotNull
import java.io.File
import java.util.UUID

object TestDatabase {
    val app = UUID.fromString("00000000-0000-0000-0000-000000000001")
    val other = UUID.fromString("00000000-0000-0000-0000-000000000002")

    fun connect() {
        val url = System.getenv("TEST_DATABASE_URL")
        assumeNotNull(url)
        require(url!!.endsWith("/bananalytics_test"))
        Database.connect(url, "org.postgresql.Driver", "bananalytics", System.getenv("TEST_DATABASE_PASSWORD") ?: "perf-local")
        sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        sql(File("src/main/resources/db/init.sql").readText())
        File("src/main/resources/db/migrations").listFiles()!!.filter { it.extension == "sql" }
            .sortedBy { it.name }.forEach { sql(it.readText()) }
    }

    fun reset() {
        sql("TRUNCATE apps, users, events, event_stats_daily, device_stats_daily RESTART IDENTITY CASCADE")
        sql("INSERT INTO apps(id,name,package_name) VALUES ('$app','Test','test.app'),('$other','Other','other.app')")
    }

    fun sql(sql: String) = transaction { exec(sql); Unit }

    fun count(table: String): Long = transaction { exec("SELECT COUNT(*) FROM $table") { it.next(); it.getLong(1) }!! }

    fun session(role: String): UUID {
        val user = UserRepository.create("$role@example.test", "unused", role)
        AppAccessRepository.grantAccess(app, UUID.fromString(user.id), role)
        return SessionRepository.create(UUID.fromString(user.id))
    }
}

fun ApplicationTestBuilder.api() {
    application { configureSerialization(); configureStatusPages(); configureRouting() }
}

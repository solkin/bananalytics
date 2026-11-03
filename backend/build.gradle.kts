plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    id("io.ktor.plugin") version "3.5.2"
    application
}

group = "com.bananalytics"
version = "1.0.0"

application {
    mainClass.set("com.bananalytics.ApplicationKt")
}

repositories {
    mavenCentral()
    google()
}

val ktorVersion = "3.5.2"
val exposedVersion = "0.57.0"
val logbackVersion = "1.5.15"

dependencies {
    // Ktor Server
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-server-cors:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")

    // Database
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-dao:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-kotlin-datetime:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-json:$exposedVersion")
    implementation("org.postgresql:postgresql:42.7.4")
    implementation("com.zaxxer:HikariCP:6.2.1")

    // Model Context Protocol server for agents
    implementation("io.modelcontextprotocol:kotlin-sdk-server:0.16.0")

    // R8 Retrace for deobfuscation
    implementation("com.android.tools:r8:8.5.35")

    // S3 Storage (MinIO compatible)
    implementation("software.amazon.awssdk:s3:2.29.51")

    // Password hashing
    implementation("at.favre.lib:bcrypt:0.10.2")

    // Email (Jakarta Mail)
    implementation("org.simplejavamail:simple-java-mail:8.12.4")

    // Logging
    implementation("ch.qos.logback:logback-classic:$logbackVersion")

    // Testing
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test:2.4.21")
}

ktor {
    fatJar {
        archiveFileName.set("bananalytics.jar")
    }
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    environment("REGISTRATION_ENABLED", "false")
    environment("MAX_APK_SIZE_MB", "52")
    maxHeapSize = "1g"
}

package com.bananalytics.config

import com.bananalytics.services.StorageService
import io.ktor.server.application.*

fun Application.configureStorage() {
    val endpoint = System.getenv("S3_ENDPOINT") ?: "http://localhost:9000"
    val accessKey = System.getenv("S3_ACCESS_KEY") ?: "minioadmin"
    val secretKey = System.getenv("S3_SECRET_KEY") ?: "minioadmin"
    val bucket = System.getenv("S3_BUCKET") ?: "bananalytics"

    StorageService.init(endpoint, accessKey, secretKey, bucket)
}

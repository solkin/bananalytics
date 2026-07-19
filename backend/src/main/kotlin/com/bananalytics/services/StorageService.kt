package com.bananalytics.services

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.*
import org.slf4j.LoggerFactory
import java.net.URI
import java.time.Duration

object StorageService {
    private val logger = LoggerFactory.getLogger(StorageService::class.java)
    private lateinit var s3Client: S3Client
    private lateinit var bucketName: String

    fun init(endpoint: String, accessKey: String, secretKey: String, bucket: String) {
        bucketName = bucket

        val credentials = AwsBasicCredentials.create(accessKey, secretKey)

        s3Client = S3Client.builder()
            .endpointOverride(URI.create(endpoint))
            .region(Region.US_EAST_1) // Required but ignored by MinIO
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
            .forcePathStyle(true) // Required for MinIO
            .overrideConfiguration(
                ClientOverrideConfiguration.builder()
                    .apiCallAttemptTimeout(Duration.ofSeconds(5))
                    .apiCallTimeout(Duration.ofSeconds(10))
                    .build()
            )
            .build()

        ensureBucketExists()
    }

    private fun ensureBucketExists() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build())
        } catch (e: NoSuchBucketException) {
            s3Client.createBucket(CreateBucketRequest.builder().bucket(bucketName).build())
        }
    }

    fun uploadMapping(appId: String, versionCode: Long, content: String): String {
        val key = "mappings/$appId/$versionCode/mapping.txt"

        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType("text/plain")
                .build(),
            RequestBody.fromString(content)
        )

        return key
    }

    fun getMapping(appId: String, versionCode: Long): String? {
        val key = "mappings/$appId/$versionCode/mapping.txt"
        return getObject(key)
    }

    fun getMappingByKey(key: String): String? {
        return getObject(key)
    }

    private fun getObject(key: String): String? {
        return try {
            val response = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build()
            )
            response.asUtf8String()
        } catch (e: NoSuchKeyException) {
            null
        }
    }

    fun deleteMapping(appId: String, versionCode: Long) {
        val key = "mappings/$appId/$versionCode/mapping.txt"
        deleteFiles(listOf(key))
    }

    // APK Storage

    fun uploadApk(appId: String, versionCode: Long, content: ByteArray): String {
        val key = "apks/$appId/$versionCode/app.apk"

        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType("application/vnd.android.package-archive")
                .build(),
            RequestBody.fromBytes(content)
        )

        return key
    }

    fun getApkByKey(key: String): ByteArray? {
        return try {
            val response = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build()
            )
            response.asByteArray()
        } catch (e: NoSuchKeyException) {
            null
        }
    }

    fun deleteApk(appId: String, versionCode: Long) {
        val key = "apks/$appId/$versionCode/app.apk"

        deleteFiles(listOf(key))
    }

    /** Delete known objects in a single MinIO/S3 request. */
    fun deleteFiles(keys: Collection<String>) {
        if (keys.isEmpty()) return

        try {
            val objects = keys.distinct().map {
                ObjectIdentifier.builder().key(it).build()
            }
            val response = s3Client.deleteObjects(
                DeleteObjectsRequest.builder()
                    .bucket(bucketName)
                    .delete(Delete.builder().objects(objects).quiet(true).build())
                    .build()
            )
            if (response.hasErrors()) {
                logger.warn(
                    "Storage reported {} error(s) while deleting {} object(s)",
                    response.errors().size,
                    objects.size
                )
            }
        } catch (e: Exception) {
            // Database deletion should not be held hostage by unavailable object storage.
            logger.warn("Failed to delete {} object(s) from storage: {}", keys.size, e.message)
        }
    }
}

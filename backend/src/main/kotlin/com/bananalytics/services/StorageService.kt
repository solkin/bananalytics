package com.bananalytics.services

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.*
import java.net.URI

object StorageService {
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

        try {
            s3Client.deleteObject(
                DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build()
            )
        } catch (e: Exception) {
            // Ignore if file doesn't exist
        }
    }
}

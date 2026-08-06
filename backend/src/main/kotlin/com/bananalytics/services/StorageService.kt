package com.bananalytics.services

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.awscore.AwsRequestOverrideConfiguration
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.*
import org.slf4j.LoggerFactory
import java.io.File
import java.net.URI
import java.time.Duration
import java.util.zip.GZIPInputStream

object StorageService {
    private val logger = LoggerFactory.getLogger(StorageService::class.java)
    private lateinit var s3Client: S3Client
    private lateinit var bucketName: String

    private const val APK_CONTENT_TYPE = "application/vnd.android.package-archive"
    private const val MAPPING_CONTENT_TYPE = "application/gzip"
    private const val GZIP_SUFFIX = ".gz"

    /**
     * The client-wide timeouts are sized for small objects; APKs and mappings
     * run to hundreds of megabytes and need far longer than ten seconds.
     */
    private val largeUploadTimeouts: AwsRequestOverrideConfiguration =
        AwsRequestOverrideConfiguration.builder()
            .apiCallAttemptTimeout(Duration.ofMinutes(10))
            .apiCallTimeout(Duration.ofMinutes(10))
            .build()

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

    /**
     * Mappings are stored gzipped: a release mapping is tens of megabytes of
     * text that compresses about tenfold. The `.gz` suffix on the key is what
     * tells those apart from the plain objects written before, so versions
     * uploaded earlier stay readable without a backfill.
     */
    private fun mappingKey(appId: String, versionCode: Long) =
        "mappings/$appId/$versionCode/mapping.txt$GZIP_SUFFIX"

    /** Streams an already-gzipped mapping off disk, so it never sits in heap. */
    fun uploadMapping(appId: String, versionCode: Long, file: File): String {
        val key = mappingKey(appId, versionCode)

        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(MAPPING_CONTENT_TYPE)
                .overrideConfiguration(largeUploadTimeouts)
                .build(),
            RequestBody.fromFile(file)
        )

        // Re-publishing a version that predates gzipped mappings writes to a new
        // key, so the plain object it used to point at would sit there forever.
        deleteFiles(listOf(key.removeSuffix(GZIP_SUFFIX)))

        return key
    }

    fun getMappingByKey(key: String): String? {
        val bytes = try {
            s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .overrideConfiguration(largeUploadTimeouts)
                    .build()
            ).asByteArray()
        } catch (e: NoSuchKeyException) {
            return null
        }

        return if (key.endsWith(GZIP_SUFFIX)) {
            GZIPInputStream(bytes.inputStream()).bufferedReader().use { it.readText() }
        } else {
            String(bytes, Charsets.UTF_8)
        }
    }

    // APK Storage

    /** Streams an APK straight off disk, so a large build never sits in heap. */
    fun uploadApk(appId: String, versionCode: Long, file: File): String {
        val key = "apks/$appId/$versionCode/app.apk"

        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(APK_CONTENT_TYPE)
                .overrideConfiguration(largeUploadTimeouts)
                .build(),
            RequestBody.fromFile(file)
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

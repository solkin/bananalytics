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
import java.io.InputStream
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

    /** S3 accepts at most this many keys in one list page or delete request. */
    private const val MAX_KEYS_PER_REQUEST = 1000

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

    /**
     * Opens an APK for streaming; the caller must close the stream. A build is
     * tens of megabytes, and one download per tester must not mean one copy per
     * tester in heap.
     */
    fun openApk(key: String): InputStream? {
        return try {
            s3Client.getObject(
                GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .overrideConfiguration(largeUploadTimeouts)
                    .build()
            )
        } catch (e: NoSuchKeyException) {
            null
        }
    }

    fun deleteApk(appId: String, versionCode: Long) {
        val key = "apks/$appId/$versionCode/app.apk"

        deleteFiles(listOf(key))
    }

    // Icon storage

    /**
     * An icon is a few kilobytes, so it needs none of the streaming an APK
     * does. The extension follows the content type: replacing a PNG with a
     * JPEG writes a different key, and the caller drops the object left behind.
     */
    fun uploadIcon(appId: String, file: File, contentType: String): String {
        val key = "icons/$appId/icon${iconExtension(contentType)}"

        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build(),
            RequestBody.fromFile(file)
        )

        return key
    }

    fun getIcon(key: String): ByteArray? = try {
        s3Client.getObjectAsBytes(
            GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build()
        ).asByteArray()
    } catch (e: NoSuchKeyException) {
        null
    }

    private fun iconExtension(contentType: String) = when (contentType) {
        "image/jpeg" -> ".jpg"
        "image/webp" -> ".webp"
        else -> ".png"
    }

    /**
     * Everything an app owns lives under these three prefixes: one APK and one
     * mapping per version, one icon per app. Sweeping by prefix rather than by
     * the paths stored on the rows also collects what a row never recorded:
     * uploads happen outside the transaction that writes the path, and a
     * mapping re-uploaded before the gzip switch left the plain object behind.
     */
    fun deleteAppFiles(appId: String) {
        deleteByPrefix("apks/$appId/")
        deleteByPrefix("mappings/$appId/")
        deleteByPrefix("icons/$appId/")
    }

    private fun deleteByPrefix(prefix: String) {
        try {
            s3Client.listObjectsV2Paginator(
                ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .prefix(prefix)
                    .maxKeys(MAX_KEYS_PER_REQUEST)
                    .build()
            ).forEach { page ->
                deleteFiles(page.contents().map { it.key() })
            }
        } catch (e: Exception) {
            // Same bargain as deleteFiles: losing the bucket must not block the caller.
            logger.warn("Failed to list objects under {}: {}", prefix, e.message)
        }
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

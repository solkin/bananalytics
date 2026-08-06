package com.bananalytics.routes

import com.bananalytics.config.PayloadTooLargeException
import io.ktor.http.content.*
import io.ktor.utils.io.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.zip.GZIPOutputStream

private const val COPY_BUFFER_SIZE = 64 * 1024

/**
 * Taking a file off a multipart request is the same job wherever it happens:
 * APKs and mappings run to tens of megabytes, so nothing here goes through the
 * heap on its way to storage.
 */

/**
 * Receives a part into a temp file, refusing it the moment it outgrows the
 * limit. The caller owns the file and must delete it.
 */
internal suspend fun PartData.FileItem.receiveFile(limit: Long, what: String, suffix: String): File {
    val target = File.createTempFile("bananalytics-", suffix)
    try {
        provider().copyToFile(target, limit, what)
    } catch (e: Throwable) {
        // Nothing owns it yet, and half an upload must not stay on the disk.
        target.delete()
        throw e
    }
    return target
}

/**
 * Receives a mapping part as the gzipped file that storage wants. Callers are
 * expected to compress before sending — a mapping shrinks about tenfold — but a
 * plain file is accepted and compressed here. Returns null for an empty part;
 * the caller owns the file and must delete it.
 */
internal suspend fun PartData.FileItem.receiveMapping(limit: Long): File? {
    val received = receiveFile(limit, "Mapping file", ".tmp")

    if (received.length() == 0L) {
        received.delete()
        return null
    }
    if (received.isGzip()) {
        return received
    }

    // Arrived as plain text, so it is compressed here and the original dropped.
    return try {
        received.gzipToTempFile()
    } finally {
        received.delete()
    }
}

private suspend fun ByteReadChannel.copyToFile(target: File, limit: Long, what: String): Long =
    withContext(Dispatchers.IO) {
        var total = 0L
        val buffer = ByteArray(COPY_BUFFER_SIZE)
        target.outputStream().buffered().use { out ->
            while (!isClosedForRead) {
                val read = readAvailable(buffer)
                if (read <= 0) break
                total += read
                if (total > limit) {
                    throw PayloadTooLargeException("$what exceeds the ${mb(limit)} MB limit")
                }
                out.write(buffer, 0, read)
            }
        }
        total
    }

private suspend fun File.gzipToTempFile(): File = withContext(Dispatchers.IO) {
    val gzipped = File.createTempFile("bananalytics-mapping-", ".gz")
    try {
        inputStream().buffered().use { input ->
            GZIPOutputStream(gzipped.outputStream().buffered()).use { input.copyTo(it) }
        }
    } catch (e: Throwable) {
        gzipped.delete()
        throw e
    }
    gzipped
}

/** gzip's two magic bytes are all that tells a compressed mapping from a plain one. */
private fun File.isGzip(): Boolean = inputStream().use { stream ->
    val header = ByteArray(2)
    stream.read(header) == 2 && header[0] == 0x1F.toByte() && header[1] == 0x8B.toByte()
}

internal fun mb(bytes: Long): Long = bytes / (1024 * 1024)

package com.bananalytics.services

import org.slf4j.LoggerFactory
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.ZipFile

/** The only three things a release upload needs to know about an APK. */
data class ApkManifest(
    val packageName: String,
    val versionCode: Long?,
    val versionName: String?
)

/**
 * Reads `AndroidManifest.xml` out of an APK so CI can publish a build without
 * repeating the package and version it already baked into the file.
 *
 * The manifest inside an APK is binary AXML — a stream of chunks: a header, a
 * string pool holding every name and literal, then the XML tree. Everything we
 * need lives in the attributes of the first `<manifest>` element, so parsing
 * stops there and `resources.arsc` is never opened. That is also the one
 * limitation: a `versionName` written as `@string/…` is a resource reference in
 * the manifest, and comes back as null.
 */
object ApkManifestParser {
    private val logger = LoggerFactory.getLogger(ApkManifestParser::class.java)

    private const val MANIFEST_ENTRY = "AndroidManifest.xml"
    private const val MAX_MANIFEST_BYTES = 8 * 1024 * 1024
    private const val ANDROID_NS = "http://schemas.android.com/apk/res/android"

    // Chunk types (frameworks/base ResourceTypes.h)
    private const val CHUNK_STRING_POOL = 0x0001
    private const val CHUNK_XML = 0x0003
    private const val CHUNK_START_ELEMENT = 0x0102

    // Res_value data types
    private const val VALUE_STRING = 0x03
    private const val VALUE_INT_DEC = 0x10
    private const val VALUE_INT_HEX = 0x11

    private const val UTF8_FLAG = 1 shl 8

    /** A ResStringPool_ref pointing at nothing. */
    private const val NO_REF = -1

    /** Guards against a corrupt pool header asking us to allocate wildly. */
    private const val MAX_POOL_STRINGS = 200_000

    /** Returns null for anything that is not a readable APK. */
    fun read(apk: File): ApkManifest? {
        val manifestBytes = try {
            ZipFile(apk).use { zip ->
                val entry = zip.getEntry(MANIFEST_ENTRY) ?: return null
                // One byte past the cap tells an oversized manifest apart from a
                // manifest that merely fills it, so it is rejected, not truncated.
                zip.getInputStream(entry).use { it.readNBytes(MAX_MANIFEST_BYTES + 1) }
            }
        } catch (e: Exception) {
            logger.debug("Not a readable APK: {}", e.message)
            return null
        }

        if (manifestBytes.size > MAX_MANIFEST_BYTES) {
            logger.warn("AndroidManifest.xml is larger than {} bytes", MAX_MANIFEST_BYTES)
            return null
        }

        return try {
            parse(manifestBytes)
        } catch (e: Exception) {
            // Malformed AXML must read as "not an APK", never as a 500.
            logger.warn("Failed to parse AndroidManifest.xml: {}", e.message)
            null
        }
    }

    private fun parse(bytes: ByteArray): ApkManifest? {
        val buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        if (bytes.size < 8 || u16(buf, 0) != CHUNK_XML) return null

        var strings: List<String> = emptyList()
        var offset = u16(buf, 2) // the file header's own size — chunks follow it

        while (offset + 8 <= bytes.size) {
            val type = u16(buf, offset)
            val headerSize = u16(buf, offset + 2)
            val size = buf.getInt(offset + 4)
            if (size < 8 || headerSize < 8 || offset + size > bytes.size) return null

            when (type) {
                CHUNK_STRING_POOL -> strings = readStringPool(buf, offset, headerSize)
                CHUNK_START_ELEMENT -> {
                    // In a manifest the root element comes first, but skip past
                    // anything unexpected rather than giving up on it.
                    if (elementName(buf, offset, headerSize, strings) == "manifest") {
                        return readManifestAttributes(buf, offset, headerSize, strings)
                    }
                }
            }

            offset += size
        }

        return null
    }

    private fun readStringPool(buf: ByteBuffer, chunkStart: Int, headerSize: Int): List<String> {
        val stringCount = buf.getInt(chunkStart + 8)
        val flags = buf.getInt(chunkStart + 16)
        val stringsStart = buf.getInt(chunkStart + 20)
        if (stringCount <= 0 || stringCount > MAX_POOL_STRINGS) return emptyList()

        val utf8 = (flags and UTF8_FLAG) != 0
        val offsetsStart = chunkStart + headerSize

        return (0 until stringCount).map { i ->
            val at = chunkStart + stringsStart + buf.getInt(offsetsStart + i * 4)
            if (utf8) readUtf8(buf, at) else readUtf16(buf, at)
        }
    }

    /** Lengths carry a continuation bit: one unit normally, two when set. */
    private fun readUtf16(buf: ByteBuffer, at: Int): String {
        var p = at
        var length = u16(buf, p)
        p += 2
        if (length and 0x8000 != 0) {
            length = ((length and 0x7FFF) shl 16) or u16(buf, p)
            p += 2
        }
        val chars = CharArray(length) { i -> u16(buf, p + i * 2).toChar() }
        return String(chars)
    }

    private fun readUtf8(buf: ByteBuffer, at: Int): String {
        var p = at
        // Character count comes first and is of no use to us — skip it.
        p += if (u8(buf, p) and 0x80 != 0) 2 else 1
        var byteLength = u8(buf, p)
        p += 1
        if (byteLength and 0x80 != 0) {
            byteLength = ((byteLength and 0x7F) shl 8) or u8(buf, p)
            p += 1
        }
        val bytes = ByteArray(byteLength) { i -> buf.get(p + i) }
        return String(bytes, Charsets.UTF_8)
    }

    private fun elementName(
        buf: ByteBuffer,
        chunkStart: Int,
        headerSize: Int,
        strings: List<String>
    ): String? {
        // ResXMLTree_attrExt starts where the node header ends: ns, then name.
        val attrExt = chunkStart + headerSize
        return strings.getOrNull(buf.getInt(attrExt + 4))
    }

    private fun readManifestAttributes(
        buf: ByteBuffer,
        chunkStart: Int,
        headerSize: Int,
        strings: List<String>
    ): ApkManifest? {
        val attrExt = chunkStart + headerSize
        val attributeStart = u16(buf, attrExt + 8)
        val attributeSize = u16(buf, attrExt + 10)
        val attributeCount = u16(buf, attrExt + 12)
        if (attributeSize < 20) return null

        var packageName: String? = null
        var versionCode: Long? = null
        var versionName: String? = null

        for (i in 0 until attributeCount) {
            val at = attrExt + attributeStart + i * attributeSize
            val namespace = strings.getOrNull(buf.getInt(at))
            val name = strings.getOrNull(buf.getInt(at + 4)) ?: continue
            val rawValue = buf.getInt(at + 8)
            // Res_value: size (u16), res0 (u8), dataType (u8), data (u32)
            val dataType = u8(buf, at + 15)
            val data = buf.getInt(at + 16)

            val asString = when {
                rawValue != NO_REF -> strings.getOrNull(rawValue)
                dataType == VALUE_STRING -> strings.getOrNull(data)
                else -> null
            }

            when {
                name == "package" && namespace == null -> packageName = asString
                name == "versionCode" && namespace == ANDROID_NS -> {
                    versionCode = if (dataType == VALUE_INT_DEC || dataType == VALUE_INT_HEX) {
                        data.toLong() and 0xFFFFFFFFL
                    } else {
                        asString?.toLongOrNull()
                    }
                }
                name == "versionName" && namespace == ANDROID_NS -> versionName = asString
            }
        }

        return packageName?.let { ApkManifest(it, versionCode, versionName) }
    }

    private fun u8(buf: ByteBuffer, at: Int): Int = buf.get(at).toInt() and 0xFF

    private fun u16(buf: ByteBuffer, at: Int): Int = buf.getShort(at).toInt() and 0xFFFF
}

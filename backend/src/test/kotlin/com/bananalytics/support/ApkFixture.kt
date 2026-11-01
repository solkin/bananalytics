package com.bananalytics.support

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

fun apkFixture(paddingBytes: Int): File {
    val strings = listOf("manifest", "package", "test.app", "http://schemas.android.com/apk/res/android", "versionCode")
    val text = strings.map { value -> byteArrayOf(value.length.toByte(), value.length.toByte()) + value.toByteArray() + 0.toByte() }
    val poolSize = 28 + strings.size * 4 + text.sumOf { it.size }
    val nodeSize = 16 + 20 + 2 * 20
    val xml = ByteBuffer.allocate(8 + poolSize + nodeSize).order(ByteOrder.LITTLE_ENDIAN)
    xml.putShort(3).putShort(8).putInt(xml.capacity())
    xml.putShort(1).putShort(28).putInt(poolSize).putInt(strings.size).putInt(0).putInt(0x100)
        .putInt(28 + strings.size * 4).putInt(0)
    var offset = 0
    text.forEach { xml.putInt(offset); offset += it.size }
    text.forEach(xml::put)
    xml.putShort(0x102).putShort(16).putInt(nodeSize).putInt(1).putInt(-1)
        .putInt(-1).putInt(0).putShort(20).putShort(20).putShort(2).putShort(0).putShort(0).putShort(0)
    xml.putInt(-1).putInt(1).putInt(2).putShort(8).put(0).put(3).putInt(2)
    xml.putInt(3).putInt(4).putInt(-1).putShort(8).put(0).put(0x10).putInt(7)
    val file = File.createTempFile("release-test-", ".apk")
    ZipOutputStream(file.outputStream()).use { out ->
        out.putNextEntry(ZipEntry("AndroidManifest.xml"))
        out.write(xml.array()); out.closeEntry()
        val zeros = ByteArray(64 * 1024)
        val crc = CRC32()
        var left = paddingBytes
        while (left > 0) { val count = minOf(left, zeros.size); crc.update(zeros, 0, count); left -= count }
        out.putNextEntry(ZipEntry("payload").apply {
            method = ZipEntry.STORED; size = paddingBytes.toLong(); this.crc = crc.value
        })
        left = paddingBytes
        while (left > 0) { val count = minOf(left, zeros.size); out.write(zeros, 0, count); left -= count }
        out.closeEntry()
    }
    return file
}

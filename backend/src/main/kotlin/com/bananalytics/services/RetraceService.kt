package com.bananalytics.services

import com.android.tools.r8.DiagnosticsHandler
import com.android.tools.r8.retrace.ProguardMappingSupplier
import com.android.tools.r8.retrace.RetraceStackTraceContext
import com.android.tools.r8.retrace.StringRetrace
import org.slf4j.LoggerFactory

object RetraceService {
    private val logger = LoggerFactory.getLogger(RetraceService::class.java)

    data class RetraceResult(
        val decodedStacktrace: String?,
        val error: String?
    )

    fun retrace(obfuscatedStacktrace: String, mappingContent: String): RetraceResult {
        return try {
            val mappingSupplier = ProguardMappingSupplier.builder()
                .setProguardMapProducer { mappingContent.byteInputStream() }
                .build()

            val retracer = StringRetrace.create(
                mappingSupplier,
                object : DiagnosticsHandler {},
                "",  // regular expression (empty = default)
                false  // verbose
            )

            val lines = obfuscatedStacktrace.lines()
            val retracedLines = retracer.retrace(lines, RetraceStackTraceContext.empty())
            
            // Convert the result to a list and join
            val resultLines = mutableListOf<String>()
            retracedLines.forEach { resultLines.add(it) }
            
            RetraceResult(
                decodedStacktrace = resultLines.joinToString("\n"),
                error = null
            )
        } catch (e: Exception) {
            logger.error("Failed to retrace stacktrace", e)
            RetraceResult(
                decodedStacktrace = null,
                error = e.message ?: "Unknown retrace error"
            )
        }
    }
}

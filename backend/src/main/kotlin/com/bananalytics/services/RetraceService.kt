package com.bananalytics.services

import com.android.tools.r8.Diagnostic
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
            logger.info("Starting retrace, mapping size: ${mappingContent.length} bytes")
            logger.debug("First 200 chars of mapping: ${mappingContent.take(200)}")

            val diagnosticsHandler = object : DiagnosticsHandler {
                override fun error(error: Diagnostic) {
                    logger.error("Retrace error: ${error.diagnosticMessage}")
                }
                override fun warning(warning: Diagnostic) {
                    logger.warn("Retrace warning: ${warning.diagnosticMessage}")
                }
                override fun info(info: Diagnostic) {
                    logger.info("Retrace info: ${info.diagnosticMessage}")
                }
            }

            val mappingSupplier = ProguardMappingSupplier.builder()
                .setProguardMapProducer { mappingContent.byteInputStream() }
                .build()

            val retracer = StringRetrace.create(
                mappingSupplier,
                diagnosticsHandler,
                "",  // regular expression (empty = default)
                false  // verbose
            )

            val lines = obfuscatedStacktrace.lines()
            val retracedResult = retracer.retrace(lines, RetraceStackTraceContext.empty())
            
            // Convert the result to a list
            val resultLines = mutableListOf<String>()
            retracedResult.forEach { line: String -> resultLines.add(line) }
            
            val result = resultLines.joinToString("\n")
            logger.info("Retrace completed, result size: ${result.length} bytes")
            
            // Check if anything actually changed
            if (result == obfuscatedStacktrace) {
                logger.warn("Retrace produced identical output - mapping may not match")
            }

            RetraceResult(
                decodedStacktrace = result,
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

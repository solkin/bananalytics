package com.bananalytics.services

import com.android.tools.r8.Diagnostic
import com.android.tools.r8.DiagnosticsHandler
import com.android.tools.r8.retrace.ProguardMappingSupplier
import com.android.tools.r8.retrace.RetraceOptions
import com.android.tools.r8.retrace.RetraceStackTraceContext
import com.android.tools.r8.retrace.StringRetrace
import org.slf4j.LoggerFactory

object RetraceService {
    private val logger = LoggerFactory.getLogger(RetraceService::class.java)

    data class RetraceResult(
        val decodedStacktrace: String?,
        val error: String?
    )

    // Regex to match exception lines: "ClassName: message" or "prefix: ClassName: message"
    private val exceptionLineRegex = Regex("""^(.*?)([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*):\s*(.*)$""")

    fun retrace(obfuscatedStacktrace: String, mappingContent: String): RetraceResult {
        return try {
            logger.info("Starting retrace, mapping size: ${mappingContent.length} bytes")
            logger.debug("First 200 chars of mapping: ${mappingContent.take(200)}")

            // Build class name mapping for manual deobfuscation of exception lines
            val classMapping = buildClassMapping(mappingContent)
            logger.info("Built class mapping with ${classMapping.size} entries")

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
                .setAllowExperimental(true)
                .build()

            val options = RetraceOptions.builder(diagnosticsHandler)
                .setMappingSupplier(mappingSupplier)
                .setVerbose(true)
                .build()

            val retracer = StringRetrace.create(options)

            val lines = obfuscatedStacktrace.lines()
            val retracedResult = retracer.retrace(lines, RetraceStackTraceContext.empty())
            
            // Convert the result to a list and apply manual class deobfuscation
            val resultLines = mutableListOf<String>()
            retracedResult.forEach { line: String -> 
                resultLines.add(deobfuscateExceptionLine(line, classMapping))
            }
            
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

    /**
     * Build a mapping from obfuscated class names to original class names
     * Format in mapping file: "com.example.OriginalClass -> a.b:"
     */
    private fun buildClassMapping(mappingContent: String): Map<String, String> {
        val mapping = mutableMapOf<String, String>()
        val classLineRegex = Regex("""^(\S+)\s*->\s*(\S+):$""")
        
        for (line in mappingContent.lines()) {
            val match = classLineRegex.find(line)
            if (match != null) {
                val originalClass = match.groupValues[1]
                val obfuscatedClass = match.groupValues[2]
                mapping[obfuscatedClass] = originalClass
            }
        }
        
        return mapping
    }

    /**
     * Try to deobfuscate class names in exception-style lines
     * e.g., "ra.c: Some error message" -> "com.example.MyException: Some error message"
     */
    private fun deobfuscateExceptionLine(line: String, classMapping: Map<String, String>): String {
        // Skip lines that look like stack frames
        if (line.trimStart().startsWith("at ")) {
            return line
        }
        
        val match = exceptionLineRegex.find(line) ?: return line
        
        val prefix = match.groupValues[1]
        val className = match.groupValues[2]
        val message = match.groupValues[3]
        
        val deobfuscatedClass = classMapping[className]
        
        return if (deobfuscatedClass != null) {
            logger.debug("Deobfuscated class: $className -> $deobfuscatedClass")
            "$prefix$deobfuscatedClass: $message"
        } else {
            line
        }
    }
}

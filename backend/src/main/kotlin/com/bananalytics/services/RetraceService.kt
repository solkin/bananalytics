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

    private const val MAX_CACHED_MAPPING_CHARS = 32L * 1024 * 1024
    private const val MAX_CACHED_MAPPINGS = 8
    private val cache = MappingCache<PreparedMapping>(MAX_CACHED_MAPPING_CHARS, MAX_CACHED_MAPPINGS) { it.sourceChars }

    private class PreparedMapping(
        val retracer: StringRetrace,
        val classes: Map<String, String>,
        val sourceChars: Long
    )

    fun retraceBatch(mappingPath: String, stacktraces: List<String>): List<RetraceResult> {
        val prepared = cache.get(mappingPath) {
            val content = StorageService.getMappingByKey(mappingPath)
                ?: throw com.bananalytics.config.NotFoundException("Mapping not found")
            prepare(content)
        }
        // R8's supplier lazily fills internal maps; serialize access to a shared instance.
        return synchronized(prepared) {
            stacktraces.map { stacktrace ->
                try {
                    val lines = mutableListOf<String>()
                    prepared.retracer.retrace(stacktrace.lines(), RetraceStackTraceContext.empty())
                        .forEach { line: String -> lines.add(deobfuscateExceptionLine(line, prepared.classes)) }
                    RetraceResult(lines.joinToString("\n"), null)
                } catch (e: Exception) {
                    logger.error("Failed to retrace stacktrace", e)
                    RetraceResult(null, e.message ?: "Unknown retrace error")
                }
            }
        }
    }

    private fun prepare(content: String): PreparedMapping {
        val diagnostics = object : DiagnosticsHandler {
            override fun error(error: Diagnostic) { logger.error("Retrace error: {}", error.diagnosticMessage) }
            override fun warning(warning: Diagnostic) { logger.warn("Retrace warning: {}", warning.diagnosticMessage) }
        }
        val supplier = ProguardMappingSupplier.builder()
            .setProguardMapProducer { content.byteInputStream() }
            .setAllowExperimental(true).build()
        val retracer = StringRetrace.create(RetraceOptions.builder(diagnostics)
            .setMappingSupplier(supplier).setVerbose(true).build())
        return PreparedMapping(retracer, buildClassMapping(content), content.length.toLong())
    }

    /**
     * Build a mapping from obfuscated class names to original class names
     * Format in mapping file: "com.example.OriginalClass -> a.b:"
     */
    private fun buildClassMapping(mappingContent: String): Map<String, String> {
        val mapping = mutableMapOf<String, String>()
        val classLineRegex = Regex("""^(\S+)\s*->\s*(\S+):$""")
        
        for (line in mappingContent.lineSequence()) {
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

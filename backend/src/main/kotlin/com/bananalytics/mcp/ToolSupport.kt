package com.bananalytics.mcp

import com.bananalytics.config.ApiException
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.toOffsetDateTimeOrNull
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import io.modelcontextprotocol.kotlin.sdk.types.ToolAnnotations
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import org.slf4j.LoggerFactory
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeParseException
import java.util.UUID

private val logger = LoggerFactory.getLogger("McpTools")

/** Nulls carry nothing for a model and cost tokens on every call. */
internal val ToolJson = Json {
    encodeDefaults = true
    explicitNulls = false
}

internal val READ_ONLY = ToolAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false)

/** Longest period one analytics call may cover. */
private const val MAX_PERIOD_DAYS = 366L

/**
 * Registers a tool whose handler returns the JSON text of its result. Errors a
 * person would see in the web UI reach the model as tool errors it can act on;
 * anything unexpected is logged and reported without internal detail.
 */
internal fun Server.tool(
    name: String,
    description: String,
    schema: ToolSchema,
    annotations: ToolAnnotations,
    handler: suspend (ToolArguments) -> String
) {
    addTool(name = name, description = description, inputSchema = schema, toolAnnotations = annotations) { request ->
        try {
            CallToolResult(content = listOf(TextContent(handler(ToolArguments(request.arguments ?: JsonObject(emptyMap()))))))
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            CallToolResult(content = listOf(TextContent(e.message)), isError = true)
        } catch (e: Exception) {
            logger.error("MCP tool $name failed", e)
            CallToolResult(content = listOf(TextContent("Internal error")), isError = true)
        }
    }
}

internal inline fun <reified T> toolResult(value: T): String = ToolJson.encodeToString(value)

/** Builds a tool's input schema; every property is described for the model. */
internal class SchemaBuilder {
    private val properties = mutableMapOf<String, JsonElement>()
    private val required = mutableListOf<String>()

    fun string(name: String, description: String, required: Boolean = false, enum: List<String>? = null) =
        add(name, required, buildJsonObject {
            put("type", "string")
            put("description", description)
            enum?.let { values -> putJsonArray("enum") { values.forEach { add(it) } } }
        })

    fun integer(name: String, description: String, required: Boolean = false, minimum: Long? = null, maximum: Long? = null) =
        add(name, required, buildJsonObject {
            put("type", "integer")
            put("description", description)
            minimum?.let { put("minimum", it) }
            maximum?.let { put("maximum", it) }
        })

    /** The `from`/`to` pair every analytics tool accepts. */
    fun period(defaultDays: Long) {
        string("from", "Start of the period: ISO-8601 date (2026-10-01, UTC) or date-time with offset. Defaults to $defaultDays days ago.")
        string("to", "End of the period, same format as `from`; a bare date includes that whole day. Defaults to now.")
    }

    private fun add(name: String, isRequired: Boolean, schema: JsonObject) {
        properties[name] = schema
        if (isRequired) required += name
    }

    fun build() = ToolSchema(properties = JsonObject(properties), required = required.takeIf { it.isNotEmpty() })
}

internal fun schema(block: SchemaBuilder.() -> Unit): ToolSchema = SchemaBuilder().apply(block).build()

/**
 * Typed access to a tool call's arguments. The model may send anything, so
 * every read validates and fails with a message it can correct itself by.
 */
internal class ToolArguments(private val json: JsonObject) {

    fun uuid(name: String): UUID {
        val value = string(name) ?: throw BadRequestException("$name is required")
        return runCatching { UUID.fromString(value) }.getOrNull()
            ?: throw BadRequestException("$name must be a UUID")
    }

    fun string(name: String): String? {
        val element = json[name] ?: return null
        if (element is JsonNull) return null
        val primitive = element as? JsonPrimitive
        if (primitive == null || !primitive.isString) throw BadRequestException("$name must be a string")
        return primitive.content.trim().takeIf { it.isNotEmpty() }
    }

    fun requiredString(name: String): String = string(name) ?: throw BadRequestException("$name is required")

    fun choice(name: String, allowed: List<String>): String? {
        val value = string(name) ?: return null
        if (value !in allowed) throw BadRequestException("$name must be one of: ${allowed.joinToString()}")
        return value
    }

    fun long(name: String, range: LongRange? = null): Long? {
        val element = json[name] ?: return null
        if (element is JsonNull) return null
        val primitive = element as? JsonPrimitive
        // Models often send numbers as strings; accept both, never fractions.
        val value = primitive?.takeIf { it.isString || it.longOrNull != null }?.content?.trim()?.toLongOrNull()
            ?: throw BadRequestException("$name must be an integer")
        if (range != null && value !in range) {
            throw BadRequestException("$name must be between ${range.first} and ${range.last}")
        }
        return value
    }

    fun int(name: String, default: Int, range: IntRange): Int =
        long(name, range.first.toLong()..range.last.toLong())?.toInt() ?: default

    /** Reads `from`/`to`. A bare date is a whole UTC day, so `to=2026-10-01` includes it. */
    fun period(defaultDays: Long): Pair<OffsetDateTime, OffsetDateTime> {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val to = string("to")?.let { parseInstant("to", it, endOfDay = true) } ?: now
        val from = string("from")?.let { parseInstant("from", it, endOfDay = false) } ?: to.minusDays(defaultDays)
        if (from.isAfter(to)) throw BadRequestException("from must not be after to")
        if (from.plusDays(MAX_PERIOD_DAYS).isBefore(to)) {
            throw BadRequestException("The period must not exceed $MAX_PERIOD_DAYS days")
        }
        return from to to
    }

    private fun parseInstant(name: String, value: String, endOfDay: Boolean): OffsetDateTime {
        value.toOffsetDateTimeOrNull()?.let { return it }
        return try {
            val day = LocalDate.parse(value)
            if (endOfDay) day.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1_000)
            else day.atStartOfDay().atOffset(ZoneOffset.UTC)
        } catch (e: DateTimeParseException) {
            throw BadRequestException("$name must be an ISO-8601 date or date-time")
        }
    }
}

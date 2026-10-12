package expo.modules.episodedownloads

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** How one download attempt ended. */
sealed class Outcome {
  data class Success(val file: File, val size: Long, val resumedFrom: Long) : Outcome()

  /** Worth another attempt; a partial file is kept so the next one resumes. */
  data class Retry(val code: String, val message: String) : Outcome()

  /** Retrying won't help. */
  data class Fail(val code: String, val message: String, val httpStatus: Int = 0) : Outcome()
}

/**
 * One episode download over HTTP, modelled on AntennaPod's HttpDownloader:
 * writes `<file>.part`, resumes it with `Range` / `If-Range` when the server
 * allows, and renames it into place only once it's complete.
 */
class Downloader(
  private val url: String,
  private val destination: File,
  private val headers: Map<String, String>,
  private val isStopped: () -> Boolean,
  private val onProgress: suspend (bytesWritten: Long, totalBytes: Long) -> Unit
) {
  private val part = File(destination.path + ".part")
  private val validatorFile = File(destination.path + ".part.validator")

  @Volatile private var active: HttpURLConnection? = null

  /** Unblocks a read in progress (the worker was stopped). */
  fun abort() {
    active?.disconnect()
  }

  suspend fun run(): Outcome {
    destination.parentFile?.mkdirs()
    val existing = if (part.exists()) part.length() else 0L
    val validator = if (existing > 0 && validatorFile.exists()) validatorFile.readText().trim() else ""

    val connection = try {
      open(existing, validator)
    } catch (e: TooManyRedirects) {
      return Outcome.Fail("REDIRECTS", "Too many redirects.")
    } catch (e: IOException) {
      return Outcome.Retry("NETWORK", e.message ?: "Network error")
    }
    active = connection

    try {
      val code = connection.responseCode
      when {
        code == 416 -> {
          // The partial file no longer matches the server's: start over.
          deletePartial()
          return Outcome.Retry("HTTP_416", "HTTP 416")
        }
        code == 401 || code == 403 || code == 404 || code == 410 -> {
          deletePartial()
          return Outcome.Fail("HTTP_$code", "HTTP $code", code)
        }
        code >= 400 -> return Outcome.Retry("HTTP_$code", "HTTP $code")
        code !in 200..299 -> return Outcome.Retry("HTTP_$code", "HTTP $code")
      }

      val rangeStart = contentRangeStart(connection.getHeaderField("Content-Range"))
      val append = code == 206 && existing > 0 && rangeStart == existing
      if (code == 206 && !append) {
        // A range we didn't ask for: drop what we have and fetch it whole.
        deletePartial()
        return Outcome.Retry("RANGE", "The server sent an unexpected range.")
      }

      val length = connection.contentLengthLong
      val offset = if (append) existing else 0L
      val total = when {
        append -> contentRangeTotal(connection.getHeaderField("Content-Range")) ?: if (length >= 0) offset + length else -1L
        else -> length
      }
      saveValidator(connection)

      connection.inputStream.use { input ->
        FileOutputStream(part, append).use { output ->
          val buffer = ByteArray(BUFFER_SIZE)
          var written = offset
          var lastReport = 0L
          onProgress(written, total)
          while (true) {
            if (isStopped()) return Outcome.Retry("STOPPED", "Stopped")
            val read = input.read(buffer)
            if (read == -1) break
            output.write(buffer, 0, read)
            written += read
            val now = System.currentTimeMillis()
            if (now - lastReport >= PROGRESS_INTERVAL_MS) {
              lastReport = now
              onProgress(written, total)
            }
          }
          output.flush()
          onProgress(written, total)
        }
      }

      val size = part.length()
      if (total > 0 && size < total) {
        // Kept: the next attempt resumes from here.
        return Outcome.Retry("TRUNCATED", "Download stream truncated: received $size of $total bytes.")
      }
      if (size < HTML_CHECK_LIMIT && looksLikeHtml(part)) {
        deletePartial()
        return Outcome.Fail("CAPTIVE_PORTAL", "A captive Wi-Fi login page or html page was received instead of audio.")
      }

      if (destination.exists()) destination.delete()
      if (!part.renameTo(destination)) {
        return Outcome.Retry("RENAME", "Could not move the finished file into place.")
      }
      validatorFile.delete()
      return Outcome.Success(destination, destination.length(), offset)
    } catch (e: IOException) {
      val message = e.message ?: "Network error"
      if (message.contains("ENOSPC") || message.contains("No space")) {
        return Outcome.Fail("INSUFFICIENT_SPACE", "Device storage is full (ENOSPC).")
      }
      return Outcome.Retry("NETWORK", message)
    } finally {
      active = null
      connection.disconnect()
    }
  }

  fun deletePartial() {
    part.delete()
    validatorFile.delete()
  }

  /** Follows redirects by hand: HttpURLConnection won't cross from http to https. */
  private fun open(existing: Long, validator: String): HttpURLConnection {
    val originalHost = URL(url).host
    var current = URL(url)
    repeat(MAX_REDIRECTS) {
      val connection = current.openConnection() as HttpURLConnection
      active = connection
      connection.instanceFollowRedirects = false
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      connection.setRequestProperty("Accept-Encoding", "identity")
      for ((name, value) in headers) {
        // A feed's password goes only to the feed's own host, never to a redirect target.
        if (name.equals("Authorization", ignoreCase = true) && current.host != originalHost) continue
        connection.setRequestProperty(name, value)
      }
      if (existing > 0) {
        connection.setRequestProperty("Range", "bytes=$existing-")
        if (validator.isNotEmpty()) connection.setRequestProperty("If-Range", validator)
      }
      val code = connection.responseCode
      if (code in REDIRECT_CODES) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        if (location.isNullOrEmpty()) throw IOException("Redirect without a location")
        current = URL(current, location)
        return@repeat
      }
      return connection
    }
    throw TooManyRedirects()
  }

  /** A strong ETag, else Last-Modified: what If-Range accepts. */
  private fun saveValidator(connection: HttpURLConnection) {
    val etag = connection.getHeaderField("ETag")
    val value = when {
      etag != null && !etag.startsWith("W/") -> etag
      else -> connection.getHeaderField("Last-Modified")
    }
    if (value.isNullOrEmpty()) validatorFile.delete() else validatorFile.writeText(value)
  }

  private class TooManyRedirects : Exception()

  companion object {
    private const val BUFFER_SIZE = 64 * 1024
    private const val PROGRESS_INTERVAL_MS = 1000L
    private const val HTML_CHECK_LIMIT = 100 * 1024L
    private const val MAX_REDIRECTS = 10
    private const val CONNECT_TIMEOUT_MS = 30_000
    private const val READ_TIMEOUT_MS = 60_000
    private val REDIRECT_CODES = setOf(301, 302, 303, 307, 308)

    /** `bytes 100-199/200` → 100. */
    fun contentRangeStart(header: String?): Long? =
      header?.removePrefix("bytes ")?.substringBefore('-')?.trim()?.toLongOrNull()

    /** `bytes 100-199/200` → 200; `*` → null. */
    fun contentRangeTotal(header: String?): Long? =
      header?.substringAfterLast('/', "")?.trim()?.toLongOrNull()

    fun looksLikeHtml(file: File): Boolean {
      val head = file.inputStream().use { input ->
        val bytes = ByteArray(512)
        val read = input.read(bytes)
        if (read <= 0) "" else String(bytes, 0, read, Charsets.ISO_8859_1).lowercase()
      }
      return head.contains("<!doctype html") || head.contains("<html") || head.contains("<head")
    }
  }
}

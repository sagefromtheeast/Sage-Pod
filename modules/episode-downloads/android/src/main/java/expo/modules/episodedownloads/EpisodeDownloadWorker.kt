package expo.modules.episodedownloads

import android.content.Context
import android.net.Uri
import android.net.wifi.WifiManager
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

/**
 * Downloads one episode, modelled on AntennaPod's EpisodeDownloadWorker:
 * runs in WorkManager's foreground service with a Wi-Fi lock, reports
 * progress every second, and is retried by WorkManager up to three runs.
 * It never touches Sage Pod's database; the app reads the result back.
 */
class EpisodeDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

  override suspend fun getForegroundInfo(): ForegroundInfo = DownloadNotifications.foregroundInfo(applicationContext)

  override suspend fun doWork(): Result {
    val episodeId = inputData.getInt(KEY_EPISODE_ID, 0)
    val url = inputData.getString(KEY_URL)
    val path = inputData.getString(KEY_PATH)
    if (episodeId == 0 || url.isNullOrEmpty() || path.isNullOrEmpty()) {
      return failure("BAD_REQUEST", "The download request was incomplete.", 0)
    }
    val title = inputData.getString(KEY_TITLE) ?: "Episode"
    val destination = File(Uri.parse(path).path ?: path)
    val headers = parseHeaders(inputData.getString(KEY_HEADERS))

    DownloadNotifications.add(episodeId, title)
    try {
      // Without this a long download is cut off after ten minutes. Android can
      // refuse it from the background; the download then runs as a plain job,
      // and a stopped one resumes where it left off.
      setForeground(getForegroundInfo())
    } catch (_: Exception) {
      DownloadNotifications.refresh(applicationContext)
    }

    val startedAt = System.currentTimeMillis()
    val wifiLock = acquireWifiLock()
    var downloader: Downloader? = null
    try {
      val outcome = withContext(Dispatchers.IO) {
        val worker = Downloader(url, destination, headers, { isStopped }) { written, total ->
          setProgress(workDataOf(KEY_BYTES to written, KEY_TOTAL to total))
          if (total > 0) DownloadNotifications.update(episodeId, ((written * 100) / total).toInt())
          DownloadNotifications.refresh(applicationContext)
        }
        downloader = worker
        coroutineScope {
          // A cancelled worker has to unblock the read it's waiting in.
          val watcher = launch {
            try {
              awaitCancellation()
            } finally {
              worker.abort()
            }
          }
          try {
            worker.run()
          } finally {
            watcher.cancel()
          }
        }
      }

      return when (outcome) {
        is Outcome.Success -> Result.success(
          workDataOf(
            KEY_EPISODE_ID to episodeId,
            KEY_PATH to Uri.fromFile(outcome.file).toString(),
            KEY_SIZE to outcome.size,
            KEY_RESUMED_FROM to outcome.resumedFrom,
            KEY_ELAPSED to System.currentTimeMillis() - startedAt
          )
        )
        is Outcome.Fail -> failure(outcome.code, outcome.message, outcome.httpStatus)
        is Outcome.Retry ->
          if (runAttemptCount + 1 < MAX_ATTEMPTS) Result.retry() else failure(outcome.code, outcome.message, 0)
      }
    } finally {
      wifiLock?.let { if (it.isHeld) it.release() }
      DownloadNotifications.remove(applicationContext, episodeId)
      // Cancelled by the listener: nothing to resume later.
      if (isStopped && stopReason == WorkInfo.STOP_REASON_CANCELLED_BY_APP) downloader?.deletePartial()
    }
  }

  private fun failure(code: String, message: String, httpStatus: Int): Result =
    Result.failure(
      Data.Builder()
        .putInt(KEY_EPISODE_ID, inputData.getInt(KEY_EPISODE_ID, 0))
        .putString(KEY_ERROR_CODE, code)
        .putString(KEY_ERROR_MESSAGE, message)
        .putInt(KEY_HTTP_STATUS, httpStatus)
        .build()
    )

  @Suppress("DEPRECATION")
  private fun acquireWifiLock(): WifiManager.WifiLock? =
    try {
      val manager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      manager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "sagepod:download").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) {
      null
    }

  companion object {
    const val MAX_ATTEMPTS = 3
    const val KEY_EPISODE_ID = "episodeId"
    const val KEY_URL = "url"
    const val KEY_PATH = "path"
    const val KEY_TITLE = "title"
    const val KEY_HEADERS = "headers"
    const val KEY_BYTES = "bytesWritten"
    const val KEY_TOTAL = "totalBytes"
    const val KEY_SIZE = "size"
    const val KEY_RESUMED_FROM = "resumedFrom"
    const val KEY_ELAPSED = "elapsedMs"
    const val KEY_ERROR_CODE = "errorCode"
    const val KEY_ERROR_MESSAGE = "errorMessage"
    const val KEY_HTTP_STATUS = "httpStatus"

    fun parseHeaders(json: String?): Map<String, String> {
      if (json.isNullOrEmpty()) return emptyMap()
      return try {
        val obj = JSONObject(json)
        obj.keys().asSequence().associateWith { obj.getString(it) }
      } catch (_: Exception) {
        emptyMap()
      }
    }
  }
}

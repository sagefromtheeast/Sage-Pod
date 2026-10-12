package expo.modules.episodedownloads

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.LiveData
import androidx.lifecycle.Observer
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class DownloadRequest : Record {
  @Field var episodeId: Int = 0
  @Field var url: String = ""
  @Field var path: String = ""
  @Field var title: String = ""
  @Field var headers: Map<String, String> = emptyMap()

  /** Tapped by the listener: starts now on any connection. */
  @Field var manual: Boolean = false
  @Field var unmeteredOnly: Boolean = false
  @Field var requiresCharging: Boolean = false
}

/** Episode downloads run by WorkManager (D-029), so they continue outside the app. */
class EpisodeDownloadsModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val mainHandler = Handler(Looper.getMainLooper())
  private var liveData: LiveData<List<WorkInfo>>? = null
  private val observer = Observer<List<WorkInfo>> { infos ->
    sendEvent("onChange", mapOf("downloads" to infos.map(::describe)))
  }

  override fun definition() = ModuleDefinition {
    Name("EpisodeDownloads")

    Events("onChange")

    OnCreate {
      val workManager = WorkManager.getInstance(context)
      mainHandler.post {
        liveData = workManager.getWorkInfosByTagLiveData(TAG).also { it.observeForever(observer) }
      }
    }

    OnDestroy {
      mainHandler.post { liveData?.removeObserver(observer) }
    }

    AsyncFunction("enqueue") { request: DownloadRequest ->
      val workManager = WorkManager.getInstance(context)
      val name = uniqueName(request.episodeId)

      val constraints = Constraints.Builder()
        .setRequiredNetworkType(
          if (!request.manual && request.unmeteredOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
        )
        .setRequiresCharging(!request.manual && request.requiresCharging)
        .build()

      val builder = OneTimeWorkRequestBuilder<EpisodeDownloadWorker>()
        .setConstraints(constraints)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
        .addTag(TAG)
        .addTag(episodeTag(request.episodeId))
        .setInputData(
          workDataOf(
            EpisodeDownloadWorker.KEY_EPISODE_ID to request.episodeId,
            EpisodeDownloadWorker.KEY_URL to request.url,
            EpisodeDownloadWorker.KEY_PATH to request.path,
            EpisodeDownloadWorker.KEY_TITLE to request.title,
            EpisodeDownloadWorker.KEY_HEADERS to JSONObject(request.headers).toString()
          )
        )
      if (request.manual) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)

      // A tap overrides an automatic download still waiting for Wi-Fi or power;
      // one already running is left alone.
      val running = workManager.getWorkInfosForUniqueWork(name).get().any { it.state == WorkInfo.State.RUNNING }
      val policy = if (request.manual && !running) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP
      workManager.enqueueUniqueWork(name, policy, builder.build())
      Unit
    }

    AsyncFunction("cancel") { episodeId: Int, path: String ->
      WorkManager.getInstance(context).cancelUniqueWork(uniqueName(episodeId)).result.get()
      // The worker might not be running, so the partial file goes here too.
      val file = File(Uri.parse(path).path ?: path)
      File(file.path + ".part").delete()
      File(file.path + ".part.validator").delete()
      Unit
    }

    AsyncFunction("getAll") {
      WorkManager.getInstance(context).getWorkInfosByTag(TAG).get().map(::describe)
    }

    /** Forgets finished work once the app has recorded its results. */
    AsyncFunction("clearFinished") {
      WorkManager.getInstance(context).pruneWork().result.get()
      Unit
    }
  }

  private fun describe(info: WorkInfo): Map<String, Any?> {
    val output = info.outputData
    val episodeId = info.tags.firstNotNullOfOrNull { tag ->
      tag.removePrefix(EPISODE_TAG_PREFIX).takeIf { tag.startsWith(EPISODE_TAG_PREFIX) }?.toIntOrNull()
    } ?: 0
    return mapOf(
      "id" to info.id.toString(),
      "episodeId" to episodeId,
      "state" to info.state.name,
      "attempt" to info.runAttemptCount,
      "bytesWritten" to info.progress.getLong(EpisodeDownloadWorker.KEY_BYTES, 0L).toDouble(),
      "totalBytes" to info.progress.getLong(EpisodeDownloadWorker.KEY_TOTAL, -1L).toDouble(),
      "path" to output.getString(EpisodeDownloadWorker.KEY_PATH),
      "size" to output.getLong(EpisodeDownloadWorker.KEY_SIZE, -1L).toDouble(),
      "resumedFrom" to output.getLong(EpisodeDownloadWorker.KEY_RESUMED_FROM, 0L).toDouble(),
      "elapsedMs" to output.getLong(EpisodeDownloadWorker.KEY_ELAPSED, 0L).toDouble(),
      "errorCode" to output.getString(EpisodeDownloadWorker.KEY_ERROR_CODE),
      "errorMessage" to output.getString(EpisodeDownloadWorker.KEY_ERROR_MESSAGE),
      "httpStatus" to output.getInt(EpisodeDownloadWorker.KEY_HTTP_STATUS, 0)
    )
  }

  companion object {
    private const val TAG = "sagepod-episode-download"
    private const val EPISODE_TAG_PREFIX = "episode:"

    private fun uniqueName(episodeId: Int) = "episode-download-$episodeId"

    private fun episodeTag(episodeId: Int) = "$EPISODE_TAG_PREFIX$episodeId"
  }
}

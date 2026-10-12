package expo.modules.episodedownloads

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo

/**
 * The one ongoing "Downloading episodes" notification every running worker
 * shares, listing each title and its percentage (AntennaPod's layout).
 */
object DownloadNotifications {
  private const val CHANNEL_ID = "episode-downloads"
  private const val NOTIFICATION_ID = 0x5a6e

  private val progress = linkedMapOf<Int, Pair<String, Int>>()

  fun add(episodeId: Int, title: String) = synchronized(progress) { progress[episodeId] = title to -1 }

  fun update(episodeId: Int, percent: Int) = synchronized(progress) {
    progress[episodeId]?.let { progress[episodeId] = it.first to percent }
  }

  fun remove(context: Context, episodeId: Int) {
    val empty = synchronized(progress) {
      progress.remove(episodeId)
      progress.isEmpty()
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (empty) manager.cancel(NOTIFICATION_ID) else refresh(context)
  }

  fun refresh(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    try {
      manager.notify(NOTIFICATION_ID, build(context))
    } catch (_: SecurityException) {
      // Notifications turned off: the download carries on without one.
    }
  }

  fun foregroundInfo(context: Context): ForegroundInfo {
    val notification = build(context)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      ForegroundInfo(NOTIFICATION_ID, notification)
    }
  }

  private fun build(context: Context): Notification {
    ensureChannel(context)
    val items = synchronized(progress) { progress.values.toList() }
    val title = if (items.size == 1) "Downloading 1 episode" else "Downloading ${items.size} episodes"
    val lines = items.joinToString("\n") { (name, percent) -> if (percent >= 0) "$name ($percent%)" else name }
    val overall = items.map { it.second }.filter { it >= 0 }.let { if (it.isEmpty()) -1 else it.sum() / it.size }

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(title)
      .setContentText(items.firstOrNull()?.first ?: "")
      .setStyle(NotificationCompat.BigTextStyle().bigText(lines))
      .setProgress(100, overall.coerceAtLeast(0), overall < 0)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setContentIntent(openDownloads(context))
      .build()
  }

  /** Opens Sage Pod's Downloads screen. */
  private fun openDownloads(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("sagepod://downloads"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Progress of episode downloads"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }
}

package __PACKAGE__

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.core.content.ContextCompat
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture

/**
 * Sage Pod's Quick Settings tile (D-026): play or pause what the player has
 * loaded, through expo-audio's media session, as the lock screen does. With
 * nothing loaded it opens the app instead.
 */
class PlaybackTileService : TileService() {
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null

  private val listener = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) = refresh()
  }

  override fun onStartListening() {
    super.onStartListening()
    connect { refresh() }
  }

  override fun onStopListening() {
    disconnect()
    super.onStopListening()
  }

  override fun onDestroy() {
    disconnect()
    super.onDestroy()
  }

  override fun onClick() {
    super.onClick()
    connect { player ->
      when {
        player == null || player.mediaItemCount == 0 -> openApp()
        player.playWhenReady -> player.pause()
        else -> player.play()
      }
      refresh()
    }
  }

  private fun connect(then: (MediaController?) -> Unit) {
    controller?.takeIf { it.isConnected }?.let { then(it); return }
    disconnect()
    val token = SessionToken(this, ComponentName(this, PLAYBACK_SERVICE))
    val future = MediaController.Builder(this, token).buildAsync()
    controllerFuture = future
    future.addListener({
      // Refused (no session yet) or cancelled by onStopListening.
      val connected = try { future.get() } catch (e: Exception) { null }
      if (controllerFuture !== future) {
        connected?.release()
        return@addListener
      }
      controller = connected
      connected?.addListener(listener)
      then(connected)
    }, ContextCompat.getMainExecutor(this))
  }

  private fun disconnect() {
    controller?.removeListener(listener)
    controllerFuture?.let { MediaController.releaseFuture(it) }
    controllerFuture = null
    controller = null
  }

  private fun refresh() {
    val tile = qsTile ?: return
    val player = controller
    val loaded = player != null && player.mediaItemCount > 0
    val playing = loaded && player!!.playWhenReady
    tile.state = if (playing) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
    tile.contentDescription = if (playing) "Pause Sage Pod" else "Play Sage Pod"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = when {
        playing -> "Playing"
        loaded -> "Paused"
        else -> null
      }
    }
    tile.updateTile()
  }

  private fun openApp() {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
      startActivityAndCollapse(pending)
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(intent)
    }
  }

  private companion object {
    const val PLAYBACK_SERVICE = "expo.modules.audio.service.AudioControlsService"
  }
}

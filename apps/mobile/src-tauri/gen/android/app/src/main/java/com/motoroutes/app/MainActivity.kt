package com.motoroutes.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
    /**
     * Tap con la app completamente cerrada: Android crea esta Activity desde
     * cero y llama a `onCreate`, no a `onNewIntent` — reenviar directamente
     * por `NotificationsPlugin.tapChannel` aquí se perdería en silencio
     * porque el listener JS (`listenForNotificationTaps`) todavía no ha
     * tenido tiempo de registrarse (carrera de arranque). Se deja constancia
     * en SharedPreferences y es el propio JS quien lo consulta una vez listo
     * (comando `get_pending_tap_screen`) — mismo patrón ya usado para
     * `PREF_PENDING_TOKEN_REFRESH` en NotificationsPlugin.kt.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (intent.getStringExtra(FcmService.EXTRA_OPEN_SCREEN) == FcmService.OPEN_SCREEN_SHARING) {
            getSharedPreferences(NotificationsPlugin.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(NotificationsPlugin.PREF_PENDING_TAP_SCREEN, FcmService.OPEN_SCREEN_SHARING)
                .apply()
        }
    }

    /**
     * `launchMode="singleTask"` (AndroidManifest.xml) hace que un tap en la
     * notificación de FCM reentre aquí en vez de crear una instancia nueva —
     * reenvía la señal al lado Rust vía el canal ya registrado por
     * NotificationsPlugin (ver notifications.rs, design.md Decisión 5). Caso
     * "app ya en marcha", complementario al de `onCreate` de arriba.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getStringExtra(FcmService.EXTRA_OPEN_SCREEN) == FcmService.OPEN_SCREEN_SHARING) {
            NotificationsPlugin.tapChannel?.sendObject(mapOf("type" to "route_share_invite"))
        }
    }

    fun startRecordingService() {
        val intent = Intent(this, RecordingService::class.java)
        startForegroundService(intent)
    }

    fun stopRecordingService() {
        val intent = Intent(this, RecordingService::class.java).apply {
            action = RecordingService.ACTION_STOP
        }
        startService(intent)
    }

    fun pauseRecordingLocationUpdates() {
        val intent = Intent(this, RecordingService::class.java).apply {
            action = RecordingService.ACTION_PAUSE
        }
        startService(intent)
    }

    fun resumeRecordingLocationUpdates() {
        val intent = Intent(this, RecordingService::class.java).apply {
            action = RecordingService.ACTION_RESUME
        }
        startService(intent)
    }
}
package com.motoroutes.app

import android.app.Activity
import android.content.Context
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.messaging.FirebaseMessaging

@InvokeArg
class RegisterTapChannelArgs {
    lateinit var channel: Channel
}

/**
 * Puente Tauri -> Android nativo para notificaciones push (FCM). Mismo patrón
 * que RecordingServicePlugin.kt/recording_service.rs: comandos síncronos
 * invocados desde Rust, más un canal estático (registrado una vez en el
 * arranque, ver notifications.rs) por el que MainActivity.onNewIntent()
 * reenvía el tap de una notificación de vuelta a Rust/JS.
 */
@TauriPlugin
class NotificationsPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        var tapChannel: Channel? = null
            private set

        /** Nombre de las SharedPreferences donde FcmService.onNewToken() deja el
         * token pendiente de re-registrar — Kotlin no tiene acceso a la sesión
         * (vive en SQLite, gestionada por JS), ver design.md Decisión 6. */
        const val PREFS_NAME = "notifications_prefs"
        const val PREF_PENDING_TOKEN = "pending_token_refresh"

        /** Pantalla pendiente de abrir tras un tap en notificación con la app
         * cerrada del todo (cold start) — ver MainActivity.onCreate(). */
        const val PREF_PENDING_TAP_SCREEN = "pending_tap_screen"
    }

    @Command
    fun getToken(invoke: Invoke) {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                val res = JSObject()
                res.put("token", if (task.isSuccessful) task.result else null)
                invoke.resolve(res)
            }
    }

    @Command
    fun registerTapChannel(invoke: Invoke) {
        val args = invoke.parseArgs(RegisterTapChannelArgs::class.java)
        tapChannel = args.channel
        invoke.resolve()
    }

    @Command
    fun getPendingTokenRefresh(invoke: Invoke) {
        val prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val res = JSObject()
        res.put("token", prefs.getString(PREF_PENDING_TOKEN, null))
        invoke.resolve(res)
    }

    @Command
    fun clearPendingTokenRefresh(invoke: Invoke) {
        activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(PREF_PENDING_TOKEN).apply()
        invoke.resolve()
    }

    /** Pantalla pendiente de abrir dejada por MainActivity.onCreate() en un
     * cold start vía tap de notificación, o `null` si no hay ninguna. */
    @Command
    fun getPendingTapScreen(invoke: Invoke) {
        val prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val res = JSObject()
        res.put("screen", prefs.getString(PREF_PENDING_TAP_SCREEN, null))
        invoke.resolve(res)
    }

    @Command
    fun clearPendingTapScreen(invoke: Invoke) {
        activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(PREF_PENDING_TAP_SCREEN).apply()
        invoke.resolve()
    }
}

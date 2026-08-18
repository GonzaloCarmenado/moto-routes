package com.motoroutes.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Servicio FCM (notificaciones-push-fcm). `onNewToken` guarda el token nuevo
 * como pendiente en SharedPreferences — Kotlin no tiene acceso a la sesión del
 * usuario (vive en SQLite, gestionada por JS), así que no puede re-registrarlo
 * él mismo (ver design.md Decisión 6). `onMessageReceived` construye aquí el
 * texto real de la notificación: el payload que transporta FCM es opaco
 * (solo `type` + IDs, nunca nombre de ruta ni email — ver
 * specs/notificaciones-push/spec.md), así que el contenido mostrado es
 * genérico por diseño, no personalizado con esos datos.
 */
class FcmService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "moto_routes_notifications"
        private const val NOTIFICATION_ID = 2001
        const val EXTRA_OPEN_SCREEN = "open_screen"
        const val OPEN_SCREEN_SHARING = "sharing"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences(NotificationsPlugin.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(NotificationsPlugin.PREF_PENDING_TOKEN, token)
            .apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        when (message.data["type"]) {
            "route_share_invite" -> showRouteShareInviteNotification()
        }
    }

    private fun showRouteShareInviteNotification() {
        createNotificationChannel()

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_SCREEN, OPEN_SCREEN_SHARING)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nueva invitación de ruta")
            .setContentText("Alguien ha compartido una ruta contigo.")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Notificaciones",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Invitaciones de rutas compartidas y otros avisos"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}

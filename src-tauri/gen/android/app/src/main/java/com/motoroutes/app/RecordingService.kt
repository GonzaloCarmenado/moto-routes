package com.motoroutes.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Foreground service de grabación de rutas. A partir de la Fase 2 (AC-011
 * corregido, AC-020, AC-023) captura ubicación de forma nativa (no depende de
 * navigator.geolocation.watchPosition() del WebView, que Chromium puede
 * pausar/limitar en segundo plano) usando FusedLocationProviderClient, con
 * fallback a LocationManager si Google Play Services no está disponible.
 *
 * Cada ubicación capturada se reenvía al canal Tauri guardado por
 * RecordingServicePlugin (ver StartArgs.channel), que lo hace llegar de vuelta
 * a Rust/JS como el evento `recording-service://location` (AC-021).
 */
class RecordingService : Service() {

    companion object {
        const val CHANNEL_ID = "moto_routes_recording"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.motoroutes.app.STOP_RECORDING"
        const val ACTION_PAUSE = "com.motoroutes.app.PAUSE_RECORDING"
        const val ACTION_RESUME = "com.motoroutes.app.RESUME_RECORDING"
        private const val LOCATION_INTERVAL_MS = 1000L
    }

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var fusedLocationCallback: LocationCallback? = null
    private var legacyLocationListener: LocationListener? = null
    private var usingFusedLocation = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PAUSE -> {
                // Solo se deja de capturar ubicación: el servicio y la notificación
                // siguen vivos (AC-016 ya exige que la notificación persista en pausa).
                stopLocationUpdates()
                return START_STICKY
            }
            ACTION_RESUME -> {
                startLocationUpdates()
                return START_STICKY
            }
        }

        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        startLocationUpdates()

        return START_STICKY
    }

    override fun onDestroy() {
        // Red de seguridad: si Android mata el servicio sin pasar por ACTION_STOP,
        // no debe quedar un callback/listener de ubicación huérfano.
        stopLocationUpdates()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        // Guarda barata contra registrar una segunda captura si ya hay una activa.
        if (fusedLocationCallback != null || legacyLocationListener != null) return

        val playServicesAvailable = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(this) == ConnectionResult.SUCCESS

        if (playServicesAvailable) {
            usingFusedLocation = true
            val client = LocationServices.getFusedLocationProviderClient(this)
            fusedLocationClient = client
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS).build()
            val callback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    result.lastLocation?.let { sendLocation(it) }
                }
            }
            fusedLocationCallback = callback
            client.requestLocationUpdates(request, callback, mainLooper)
        } else {
            // Fallback (AC-023): Google Play Services ausente, desactualizado o
            // deshabilitado — se sigue capturando de forma nativa vía LocationManager.
            usingFusedLocation = false
            val manager = getSystemService(LocationManager::class.java)
            val listener = LocationListener { location -> sendLocation(location) }
            legacyLocationListener = listener
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, LOCATION_INTERVAL_MS, 0f, listener, mainLooper)
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationCallback?.let { fusedLocationClient?.removeLocationUpdates(it) }
        fusedLocationCallback = null
        fusedLocationClient = null

        legacyLocationListener?.let {
            getSystemService(LocationManager::class.java).removeUpdates(it)
        }
        legacyLocationListener = null
        usingFusedLocation = false
    }

    private fun sendLocation(location: Location) {
        val channel = RecordingServicePlugin.locationChannel ?: return
        channel.sendObject(
            mapOf(
                "lat" to location.latitude,
                "lng" to location.longitude,
                "alt" to location.altitude,
                "speed" to location.speed.toDouble(),
                "timestamp" to location.time
            )
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Grabación de ruta",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificación persistente mientras se graba una ruta"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, RecordingService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Moto Routes")
            .setContentText("● Grabando ruta...")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openAppPendingIntent)
            .addAction(
                android.R.drawable.ic_media_pause,
                "Detener",
                stopPendingIntent
            )
            .build()
    }
}

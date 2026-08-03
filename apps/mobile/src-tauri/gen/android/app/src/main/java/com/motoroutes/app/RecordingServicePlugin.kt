package com.motoroutes.app

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

/**
 * Argumentos de start(): el canal por el que RecordingService reenvía cada
 * ubicación capturada nativamente de vuelta a Rust (ver recording_service.rs,
 * StartArgs { channel }). El campo se llama igual (`channel`) porque Tauri
 * serializa/deserializa por nombre de campo.
 */
@InvokeArg
class StartArgs {
    lateinit var channel: Channel
}

/**
 * Puente Tauri -> Android nativo para el foreground service de grabación.
 * Invocado desde Rust vía PluginHandle::run_mobile_plugin("start"/"stop"/"pause"/"resume", ...),
 * a su vez llamado desde los comandos Tauri start_foreground_service/stop_foreground_service/
 * pause_recording_location/resume_recording_location.
 */
@TauriPlugin
class RecordingServicePlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        /** Canal activo de la grabación en curso, leído por RecordingService para
         * reenviar cada ubicación capturada nativamente de vuelta a Rust. Null
         * cuando no hay ninguna grabación activa (fuera de start()..stop()). */
        var locationChannel: Channel? = null
            private set
    }

    @Command
    fun start(invoke: Invoke) {
        val args = invoke.parseArgs(StartArgs::class.java)
        locationChannel = args.channel
        (activity as MainActivity).startRecordingService()
        invoke.resolve()
    }

    @Command
    fun stop(invoke: Invoke) {
        locationChannel = null
        (activity as MainActivity).stopRecordingService()
        invoke.resolve()
    }

    @Command
    fun pause(invoke: Invoke) {
        (activity as MainActivity).pauseRecordingLocationUpdates()
        invoke.resolve()
    }

    @Command
    fun resume(invoke: Invoke) {
        (activity as MainActivity).resumeRecordingLocationUpdates()
        invoke.resolve()
    }
}

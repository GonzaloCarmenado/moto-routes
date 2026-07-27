package com.motoroutes.app

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

/**
 * Puente Tauri -> Android nativo para el foreground service de grabación.
 * Invocado desde Rust vía PluginHandle::run_mobile_plugin("start"/"stop", ()),
 * a su vez llamado desde los comandos Tauri start_foreground_service/stop_foreground_service.
 */
@TauriPlugin
class RecordingServicePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun start(invoke: Invoke) {
        (activity as MainActivity).startRecordingService()
        invoke.resolve()
    }

    @Command
    fun stop(invoke: Invoke) {
        (activity as MainActivity).stopRecordingService()
        invoke.resolve()
    }
}

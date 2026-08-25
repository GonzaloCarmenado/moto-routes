package com.motoroutes.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
}

/**
 * Puente Tauri -> Android nativo para lanzar el instalador de APKs
 * (actualizacion-in-app). Reutiliza el FileProvider ya declarado en el
 * manifest para exportar GPX (`${applicationId}.fileprovider`) — el APK
 * descargado por update-download.service.ts vive dentro del directorio de
 * caché que ese FileProvider ya cubre por completo, sin manifest nuevo.
 */
@TauriPlugin
class InstallUpdatePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun installApk(invoke: Invoke) {
        val args = invoke.parseArgs(InstallApkArgs::class.java)
        val file = File(args.path)
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        invoke.resolve()
    }

    /** `canRequestPackageInstalls()` no existe antes de Android 8 (API 26) —
     * versiones anteriores no restringen instalar fuera de Play Store. */
    @Command
    fun canInstallPackages(invoke: Invoke) {
        val canInstall = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
        val res = JSObject()
        res.put("canInstall", canInstall)
        invoke.resolve(res)
    }

    @Command
    fun requestInstallPermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        }
        invoke.resolve()
    }
}

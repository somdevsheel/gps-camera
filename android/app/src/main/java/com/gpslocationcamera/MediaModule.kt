package com.gpslocationcamera

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.gpslocationcamera.specs.NativeGpsMediaSpec
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Hand-off to the rest of the system: MediaStore export, the share sheet,
 * clipboard and any installed maps application.
 */
class MediaModule(private val reactContext: ReactApplicationContext) :
  NativeGpsMediaSpec(reactContext) {

  companion object {
    const val NAME = "GpsMedia"
    private const val MIME_JPEG = "image/jpeg"
  }

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  /**
   * Copies the finished image into the public Pictures collection.
   *
   * On API 29+ this uses scoped storage with IS_PENDING so a partially written
   * file is never visible to other apps; below that it writes into the legacy
   * public directory and notifies MediaStore.
   */
  override fun saveToGallery(path: String, albumName: String, promise: Promise) {
    executor.execute {
      try {
        val source = File(path)
        if (!source.exists()) {
          promise.reject("FILE_MISSING", "The image no longer exists on disk.")
          return@execute
        }

        val resolver = reactContext.contentResolver
        val values =
          ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, source.name)
            put(MediaStore.Images.Media.MIME_TYPE, MIME_JPEG)
            put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
              put(
                MediaStore.Images.Media.RELATIVE_PATH,
                "${Environment.DIRECTORY_PICTURES}/$albumName",
              )
              put(MediaStore.Images.Media.IS_PENDING, 1)
            }
          }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
          val albumDir =
            File(
              Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
              albumName,
            )
          if (!albumDir.exists()) {
            albumDir.mkdirs()
          }
          val destination = File(albumDir, source.name)
          source.inputStream().use { input ->
            FileOutputStream(destination).use { output -> input.copyTo(output) }
          }
          @Suppress("DEPRECATION")
          values.put(MediaStore.Images.Media.DATA, destination.absolutePath)
          val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
          promise.resolve(uri?.toString() ?: destination.absolutePath)
          return@execute
        }

        val uri =
          resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("MediaStore rejected the insert.")

        resolver.openOutputStream(uri)?.use { output ->
          source.inputStream().use { input -> input.copyTo(output) }
        } ?: throw IllegalStateException("Could not open the MediaStore entry for writing.")

        resolver.update(
          uri,
          ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) },
          null,
          null,
        )
        promise.resolve(uri.toString())
      } catch (error: Exception) {
        promise.reject("GALLERY_SAVE_FAILED", error.message, error)
      }
    }
  }

  override fun shareImage(path: String, message: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.exists()) {
        promise.reject("FILE_MISSING", "The image no longer exists on disk.")
        return
      }
      // Internal storage is not world-readable, so the receiving app gets a
      // temporary grant through our FileProvider instead of a raw path.
      val uri: Uri =
        FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)

      val intent =
        Intent(Intent.ACTION_SEND).apply {
          type = MIME_JPEG
          putExtra(Intent.EXTRA_STREAM, uri)
          if (message.isNotBlank()) {
            putExtra(Intent.EXTRA_TEXT, message)
          }
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

      val chooser =
        Intent.createChooser(intent, "Share photo").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("SHARE_FAILED", error.message, error)
    }
  }

  override fun openInMaps(latitude: Double, longitude: Double, label: String, promise: Promise) {
    try {
      val encodedLabel = Uri.encode(label.ifBlank { "Capture location" })
      val geoUri =
        Uri.parse(
          String.format(
            Locale.US,
            "geo:%f,%f?q=%f,%f(%s)",
            latitude,
            longitude,
            latitude,
            longitude,
            encodedLabel,
          )
        )
      val intent = Intent(Intent.ACTION_VIEW, geoUri).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (intent.resolveActivity(reactContext.packageManager) == null) {
        promise.reject("MAPS_UNAVAILABLE", "No installed application can open these coordinates.")
        return
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MAPS_UNAVAILABLE", error.message, error)
    }
  }

  override fun copyToClipboard(text: String, promise: Promise) {
    try {
      val clipboard =
        reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
          ?: throw IllegalStateException("Clipboard is unavailable.")
      clipboard.setPrimaryClip(ClipData.newPlainText("Coordinates", text))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("CLIPBOARD_FAILED", error.message, error)
    }
  }
}

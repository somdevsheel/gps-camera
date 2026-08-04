package com.gpslocationcamera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.location.Location
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.gpslocationcamera.specs.NativeGpsImageSpec
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

/**
 * All pixel and file work: hashing, stamp compositing, EXIF and map tiles.
 *
 * Everything runs on a small background pool. Bitmap operations on a 12 MP
 * photo take hundreds of milliseconds and must never touch the JS thread while
 * the camera preview is live.
 */
class ImageModule(private val reactContext: ReactApplicationContext) :
  NativeGpsImageSpec(reactContext) {

  companion object {
    const val NAME = "GpsImage"

    private const val ORIGINALS_DIR = "captures/originals"
    private const val STAMPED_DIR = "captures/stamped"
    private const val MAP_CACHE_DIR = "map-tiles"

    private const val TILE_SIZE = 256
    private const val DEFAULT_MAP_TIMEOUT_MS = 6000
    /** OSM's usage policy requires an identifying User-Agent. */
    private const val USER_AGENT = "GPSLocationCamera/1.0 (Android; offline-first field camera)"
    private const val TILE_URL_TEMPLATE = "https://tile.openstreetmap.org/%d/%d/%d.png"
  }

  private val executor = Executors.newFixedThreadPool(2)

  override fun getName(): String = NAME

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  /* ------------------------------------------------------------------ */
  /* Paths & files                                                       */
  /* ------------------------------------------------------------------ */

  private fun directory(relative: String): File =
    File(reactContext.filesDir, relative).apply {
      if (!exists()) {
        mkdirs()
      }
    }

  override fun getPaths(promise: Promise) {
    try {
      promise.resolve(
        Arguments.createMap().apply {
          putString("originals", directory(ORIGINALS_DIR).absolutePath)
          putString("stamped", directory(STAMPED_DIR).absolutePath)
          putString("cache", reactContext.cacheDir.absolutePath)
        }
      )
    } catch (error: Exception) {
      promise.reject("PATHS_UNAVAILABLE", error.message, error)
    }
  }

  override fun fileExists(path: String, promise: Promise) {
    promise.resolve(File(path).exists())
  }

  override fun deleteFile(path: String, promise: Promise) {
    promise.resolve(
      try {
        val file = File(path)
        !file.exists() || file.delete()
      } catch (_: Exception) {
        false
      }
    )
  }

  override fun copyToAppStorage(sourcePath: String, fileName: String, promise: Promise) {
    executor.execute {
      try {
        val source = File(sourcePath)
        if (!source.exists()) {
          promise.reject("SOURCE_MISSING", "The captured file no longer exists.")
          return@execute
        }
        val destination = File(directory(ORIGINALS_DIR), fileName)
        source.inputStream().use { input ->
          FileOutputStream(destination).use { output -> input.copyTo(output) }
        }
        promise.resolve(destination.absolutePath)
      } catch (error: Exception) {
        promise.reject("COPY_FAILED", error.message, error)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hashing                                                             */
  /* ------------------------------------------------------------------ */

  override fun sha256File(path: String, promise: Promise) {
    executor.execute {
      try {
        val file = File(path)
        if (!file.exists()) {
          promise.reject("FILE_MISSING", "Cannot hash a file that does not exist.")
          return@execute
        }
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { stream ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = stream.read(buffer)
            if (read <= 0) break
            digest.update(buffer, 0, read)
          }
        }
        promise.resolve(digest.digest().joinToString("") { "%02x".format(it) })
      } catch (error: Exception) {
        promise.reject("HASH_FAILED", error.message, error)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Stamping                                                            */
  /* ------------------------------------------------------------------ */

  override fun stamp(options: ReadableMap, promise: Promise) {
    executor.execute {
      var bitmap: Bitmap? = null
      try {
        val sourcePath = options.getString("sourcePath")
        val outputPath = options.getString("outputPath")
        if (sourcePath.isNullOrBlank() || outputPath.isNullOrBlank()) {
          promise.reject("INVALID_ARGS", "sourcePath and outputPath are required.")
          return@execute
        }

        bitmap = StampRenderer.decodeUpright(sourcePath)
        if (bitmap == null) {
          promise.reject("DECODE_FAILED", "The captured image could not be decoded.")
          return@execute
        }

        val lines = mutableListOf<StampTextLine>()
        options.getArray("lines")?.let { array ->
          for (index in 0 until array.size()) {
            val entry = array.getMap(index) ?: continue
            val value = entry.getString("value") ?: continue
            lines.add(
              StampTextLine(
                label = entry.getString("label"),
                value = value,
                emphasis = entry.getString("emphasis") ?: "normal",
              )
            )
          }
        }

        val spec =
          StampSpec(
            title = options.getString("title") ?: "GPS LOCATION CAMERA",
            lines = lines,
            position = options.getString("position") ?: "bottom",
            textScale =
              if (options.hasKey("textScale")) options.getDouble("textScale").toFloat() else 1f,
            accentColor = parseColor(options.getString("accentColor"), Color.parseColor("#00C2A8")),
            mapImagePath = options.getString("mapImagePath"),
            logoPath = options.getString("logoPath"),
            verified = options.hasKey("verified") && options.getBoolean("verified"),
          )

        val stamped = StampRenderer.draw(bitmap, spec)
        val quality =
          if (options.hasKey("jpegQuality")) options.getDouble("jpegQuality").toInt().coerceIn(50, 100) else 95

        val outputFile = File(outputPath)
        outputFile.parentFile?.mkdirs()
        FileOutputStream(outputFile).use { output ->
          if (!stamped.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
            throw IllegalStateException("JPEG encoding failed.")
          }
        }

        val width = stamped.width
        val height = stamped.height
        if (stamped != bitmap) {
          stamped.recycle()
        }

        promise.resolve(
          Arguments.createMap().apply {
            putString("path", outputFile.absolutePath)
            putInt("width", width)
            putInt("height", height)
            putDouble("bytes", outputFile.length().toDouble())
          }
        )
      } catch (_: OutOfMemoryError) {
        promise.reject("OUT_OF_MEMORY", "The image is too large to stamp on this device.")
      } catch (error: Exception) {
        promise.reject("STAMP_FAILED", error.message, error)
      } finally {
        bitmap?.recycle()
      }
    }
  }

  private fun parseColor(value: String?, fallback: Int): Int =
    try {
      if (value.isNullOrBlank()) fallback else Color.parseColor(value)
    } catch (_: Exception) {
      fallback
    }

  /* ------------------------------------------------------------------ */
  /* EXIF                                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Adds GPS, timestamp and software tags. Existing camera metadata is left
   * untouched — only the tags written here are added or replaced.
   */
  override fun writeExifGps(options: ReadableMap, promise: Promise) {
    executor.execute {
      try {
        val path = options.getString("path")
        if (path.isNullOrBlank() || !File(path).exists()) {
          promise.resolve(false)
          return@execute
        }

        val exif = ExifInterface(path)

        if (options.hasKey("hasLocation") && options.getBoolean("hasLocation")) {
          val location =
            Location("gps").apply {
              latitude = options.getDouble("latitude")
              longitude = options.getDouble("longitude")
              if (options.hasKey("hasAltitude") && options.getBoolean("hasAltitude")) {
                altitude = options.getDouble("altitude")
              }
              time =
                if (options.hasKey("gpsTimestamp") && options.getDouble("gpsTimestamp") > 0) {
                  options.getDouble("gpsTimestamp").toLong()
                } else {
                  System.currentTimeMillis()
                }
            }
          exif.setGpsInfo(location)
        }

        if (options.hasKey("hasHeading") && options.getBoolean("hasHeading")) {
          val heading = options.getDouble("heading")
          exif.setAttribute(
            ExifInterface.TAG_GPS_IMG_DIRECTION,
            "${(heading * 100).toLong()}/100",
          )
          // "T" = true north, which is what the compass module reports when it
          // can apply magnetic declination.
          exif.setAttribute(ExifInterface.TAG_GPS_IMG_DIRECTION_REF, "T")
        }

        val timestamp =
          if (options.hasKey("timestamp")) options.getDouble("timestamp").toLong()
          else System.currentTimeMillis()
        val formatter = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US)
        val formatted = formatter.format(Date(timestamp))
        exif.setAttribute(ExifInterface.TAG_DATETIME, formatted)
        exif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, formatted)
        exif.setAttribute(ExifInterface.TAG_DATETIME_DIGITIZED, formatted)

        options.getString("software")?.let { exif.setAttribute(ExifInterface.TAG_SOFTWARE, it) }

        exif.saveAttributes()
        promise.resolve(true)
      } catch (_: Exception) {
        // EXIF is a nice-to-have; a failure must not fail the capture.
        promise.resolve(false)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Static map                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Builds a small map thumbnail from raster tiles.
   *
   * This is the only network call the app makes. It is bounded by a short
   * timeout and resolves `ok: false` on any problem so the capture pipeline can
   * fall back to a text-only stamp.
   */
  override fun renderStaticMap(options: ReadableMap, promise: Promise) {
    executor.execute {
      try {
        val latitude = options.getDouble("latitude")
        val longitude = options.getDouble("longitude")
        val zoom = if (options.hasKey("zoom")) options.getDouble("zoom").toInt().coerceIn(1, 19) else 16
        val sizePx = if (options.hasKey("sizePx")) options.getDouble("sizePx").toInt().coerceIn(128, 1024) else 512
        val timeoutMs =
          if (options.hasKey("timeoutMs")) options.getDouble("timeoutMs").toInt()
          else DEFAULT_MAP_TIMEOUT_MS

        val scale = 1 shl zoom
        val worldX = (longitude + 180.0) / 360.0 * scale
        val latRad = latitude * PI / 180.0
        val worldY = (1.0 - ln(tan(latRad) + 1.0 / cos(latRad)) / PI) / 2.0 * scale

        val centerTileX = floor(worldX).toInt()
        val centerTileY = floor(worldY).toInt()

        // 3x3 grid guarantees the crop window is fully covered at any offset.
        val canvasSize = TILE_SIZE * 3
        val mosaic = Bitmap.createBitmap(canvasSize, canvasSize, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(mosaic)
        canvas.drawColor(Color.parseColor("#E8E4DC"))

        var anyTile = false
        for (dx in -1..1) {
          for (dy in -1..1) {
            val tileX = centerTileX + dx
            val tileY = centerTileY + dy
            if (tileX < 0 || tileY < 0 || tileX >= scale || tileY >= scale) {
              continue
            }
            val tile = downloadTile(zoom, tileX, tileY, timeoutMs) ?: continue
            anyTile = true
            canvas.drawBitmap(
              tile,
              ((dx + 1) * TILE_SIZE).toFloat(),
              ((dy + 1) * TILE_SIZE).toFloat(),
              null,
            )
            tile.recycle()
          }
        }

        if (!anyTile) {
          mosaic.recycle()
          promise.resolve(failure())
          return@execute
        }

        // Where the point sits inside the centre tile, offset into the mosaic.
        val pixelX = TILE_SIZE + ((worldX - centerTileX) * TILE_SIZE).toFloat()
        val pixelY = TILE_SIZE + ((worldY - centerTileY) * TILE_SIZE).toFloat()

        val crop = min(canvasSize, max(192, sizePx / 2))
        val left = (pixelX - crop / 2f).toInt().coerceIn(0, canvasSize - crop)
        val top = (pixelY - crop / 2f).toInt().coerceIn(0, canvasSize - crop)
        val cropped = Bitmap.createBitmap(mosaic, left, top, crop, crop)
        mosaic.recycle()

        val output = Bitmap.createScaledBitmap(cropped, sizePx, sizePx, true)
        if (output != cropped) {
          cropped.recycle()
        }

        drawMarker(output, pixelX - left, pixelY - top, crop.toFloat())

        val cacheDir = File(reactContext.cacheDir, MAP_CACHE_DIR).apply { mkdirs() }
        val file = File(cacheDir, "map_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { stream ->
          output.compress(Bitmap.CompressFormat.PNG, 100, stream)
        }
        output.recycle()

        promise.resolve(
          Arguments.createMap().apply {
            putBoolean("ok", true)
            putString("path", file.absolutePath)
          }
        )
      } catch (_: OutOfMemoryError) {
        promise.resolve(failure())
      } catch (_: Exception) {
        promise.resolve(failure())
      }
    }
  }

  private fun failure() = Arguments.createMap().apply { putBoolean("ok", false) }

  /**
   * Classic teardrop map pin, tip anchored exactly on the coordinate - the
   * shape everyone recognizes from Google/Apple Maps, rather than a plain dot.
   */
  private fun drawMarker(bitmap: Bitmap, xInCrop: Float, yInCrop: Float, cropSize: Float) {
    val canvas = Canvas(bitmap)
    val scale = bitmap.width / cropSize
    val tipX = xInCrop * scale
    val tipY = yInCrop * scale
    val radius = bitmap.width * 0.052f
    val bodyCy = tipY - radius * 1.55f

    // Soft contact shadow directly under the tip, so the pin reads as
    // "standing on" the map rather than floating over it.
    val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(70, 0, 0, 0) }
    canvas.drawOval(
      RectF(tipX - radius, tipY - radius * 0.28f, tipX + radius, tipY + radius * 0.28f),
      shadow,
    )

    // Teardrop body: a circle with a triangular point tapering down to the tip.
    val spreadAngle = Math.toRadians(38.0).toFloat()
    val leftX = tipX - radius * sin(spreadAngle)
    val rightX = tipX + radius * sin(spreadAngle)
    val sideY = bodyCy + radius * cos(spreadAngle)
    val teardrop = Path().apply {
      moveTo(leftX, sideY)
      lineTo(tipX, tipY)
      lineTo(rightX, sideY)
      close()
    }
    val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#E63946") }
    canvas.drawPath(teardrop, bodyPaint)
    canvas.drawCircle(tipX, bodyCy, radius, bodyPaint)

    val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = max(1f, bitmap.width * 0.004f)
      color = Color.WHITE
    }
    canvas.drawCircle(tipX, bodyCy, radius, ringPaint)

    val holePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    canvas.drawCircle(tipX, bodyCy, radius * 0.38f, holePaint)
  }

  private fun downloadTile(zoom: Int, x: Int, y: Int, timeoutMs: Int): Bitmap? {
    var connection: HttpURLConnection? = null
    var stream: InputStream? = null
    return try {
      val url = URL(String.format(Locale.US, TILE_URL_TEMPLATE, zoom, x, y))
      connection =
        (url.openConnection() as HttpURLConnection).apply {
          connectTimeout = timeoutMs
          readTimeout = timeoutMs
          setRequestProperty("User-Agent", USER_AGENT)
          requestMethod = "GET"
        }
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
        return null
      }
      stream = connection.inputStream
      BitmapFactory.decodeStream(stream)
    } catch (_: Exception) {
      null
    } finally {
      try {
        stream?.close()
      } catch (_: Exception) {
        // Ignored.
      }
      connection?.disconnect()
    }
  }
}

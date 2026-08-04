package com.gpslocationcamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.view.Surface
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.gpslocationcamera.specs.NativeGpsCompassSpec
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Compass heading from the rotation-vector sensor, falling back to the
 * accelerometer + magnetometer pair. Devices with neither report
 * [isAvailable] = false and the app simply omits direction rather than
 * guessing one.
 */
class CompassModule(private val reactContext: ReactApplicationContext) :
  NativeGpsCompassSpec(reactContext), SensorEventListener {

  companion object {
    const val NAME = "GpsCompass"
    private const val EVENT_HEADING = "GpsCompass:heading"
    private const val DEFAULT_INTERVAL_MS = 200L
    /** Ignore updates that move the needle less than this. */
    private const val MIN_DELTA_DEG = 0.5f
  }

  private val sensorManager: SensorManager? =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private val handlerThread = HandlerThread("GpsCompassModule").apply { start() }
  private val handler = Handler(handlerThread.looper)

  private val rotationMatrix = FloatArray(9)
  private val remappedMatrix = FloatArray(9)
  private val orientation = FloatArray(3)
  private val accelerometerValues = FloatArray(3)
  private val magnetometerValues = FloatArray(3)

  private var hasAccelerometer = false
  private var hasMagnetometer = false
  private var running = false
  private var intervalMs = DEFAULT_INTERVAL_MS
  private var lastEmitAt = 0L
  private var lastHeading = Float.NaN
  private var accuracyLabel = "unknown"

  override fun getName(): String = NAME

  override fun invalidate() {
    stop()
    handlerThread.quitSafely()
    super.invalidate()
  }

  private fun rotationSensor(): Sensor? =
    sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
      ?: sensorManager?.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)

  override fun isAvailable(promise: Promise) {
    val manager = sensorManager
    if (manager == null) {
      promise.resolve(false)
      return
    }
    val hasRotation = rotationSensor() != null
    val hasPair =
      manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null &&
        manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null
    promise.resolve(hasRotation || hasPair)
  }

  override fun start(intervalMs: Double) {
    if (running) {
      return
    }
    val manager = sensorManager ?: return
    this.intervalMs = if (intervalMs > 0) intervalMs.toLong() else DEFAULT_INTERVAL_MS

    val rotation = rotationSensor()
    val registered =
      if (rotation != null) {
        manager.registerListener(this, rotation, SensorManager.SENSOR_DELAY_GAME, handler)
      } else {
        val accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val magnetometer = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        if (accelerometer == null || magnetometer == null) {
          false
        } else {
          manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME, handler) &&
            manager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME, handler)
        }
      }

    running = registered
    if (!registered) {
      manager.unregisterListener(this)
    }
  }

  override fun stop() {
    if (!running) {
      return
    }
    running = false
    hasAccelerometer = false
    hasMagnetometer = false
    lastHeading = Float.NaN
    try {
      sensorManager?.unregisterListener(this)
    } catch (_: Exception) {
      // Already unregistered.
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    accuracyLabel =
      when (accuracy) {
        SensorManager.SENSOR_STATUS_ACCURACY_HIGH -> "high"
        SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM -> "medium"
        SensorManager.SENSOR_STATUS_ACCURACY_LOW -> "low"
        SensorManager.SENSOR_STATUS_UNRELIABLE -> "unreliable"
        else -> "unknown"
      }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    val sensorEvent = event ?: return

    when (sensorEvent.sensor.type) {
      Sensor.TYPE_ROTATION_VECTOR,
      Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR -> {
        SensorManager.getRotationMatrixFromVector(rotationMatrix, sensorEvent.values)
      }
      Sensor.TYPE_ACCELEROMETER -> {
        System.arraycopy(sensorEvent.values, 0, accelerometerValues, 0, 3)
        hasAccelerometer = true
      }
      Sensor.TYPE_MAGNETIC_FIELD -> {
        System.arraycopy(sensorEvent.values, 0, magnetometerValues, 0, 3)
        hasMagnetometer = true
      }
      else -> return
    }

    if (sensorEvent.sensor.type == Sensor.TYPE_ACCELEROMETER ||
      sensorEvent.sensor.type == Sensor.TYPE_MAGNETIC_FIELD
    ) {
      if (!hasAccelerometer || !hasMagnetometer) {
        return
      }
      val ok =
        SensorManager.getRotationMatrix(
          rotationMatrix,
          null,
          accelerometerValues,
          magnetometerValues,
        )
      if (!ok) {
        return
      }
    }

    // Compensate for the current display rotation so the heading matches what
    // the camera is pointing at, not the device's natural orientation.
    val (axisX, axisY) =
      when (displayRotation()) {
        Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
        Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
        Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
        else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
      }
    SensorManager.remapCoordinateSystem(rotationMatrix, axisX, axisY, remappedMatrix)
    SensorManager.getOrientation(remappedMatrix, orientation)

    val magneticHeading = normalize(Math.toDegrees(orientation[0].toDouble()).toFloat())
    val declination = declination()
    val trueHeading =
      if (declination != null) normalize(magneticHeading + declination) else magneticHeading

    val now = SystemClock.elapsedRealtime()
    val movedEnough =
      lastHeading.isNaN() || abs(shortestDelta(lastHeading, trueHeading)) >= MIN_DELTA_DEG
    if (now - lastEmitAt < intervalMs || !movedEnough) {
      return
    }
    lastEmitAt = now
    lastHeading = trueHeading

    emit(
      Arguments.createMap().apply {
        putDouble("heading", trueHeading.toDouble())
        putDouble("magneticHeading", magneticHeading.toDouble())
        putString("accuracy", accuracyLabel)
        putBoolean("isTrueNorth", declination != null)
      }
    )
  }

  /**
   * Magnetic declination for the current position, so the stamped bearing is
   * relative to true north. Without a position we report magnetic north and
   * flag it, rather than silently mixing the two.
   */
  private fun declination(): Float? {
    val fineGranted =
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseGranted =
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (!fineGranted && !coarseGranted) {
      return null
    }
    val manager =
      reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    val location =
      try {
        manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
          ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
      } catch (_: SecurityException) {
        null
      } catch (_: Exception) {
        null
      } ?: return null

    return GeomagneticField(
        location.latitude.toFloat(),
        location.longitude.toFloat(),
        location.altitude.toFloat(),
        System.currentTimeMillis(),
      )
      .declination
  }

  @Suppress("DEPRECATION")
  private fun displayRotation(): Int =
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        reactContext.display?.rotation ?: Surface.ROTATION_0
      } else {
        val windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
      }
    } catch (_: Exception) {
      Surface.ROTATION_0
    }

  private fun normalize(value: Float): Float {
    val result = value % 360f
    return if (result < 0) result + 360f else result
  }

  private fun shortestDelta(from: Float, to: Float): Float {
    val diff = abs(normalize(from) - normalize(to))
    return if (diff > 180f) 360f - diff else diff
  }

  private fun emit(payload: WritableMap) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    try {
      reactContext.emitDeviceEvent(EVENT_HEADING, payload)
    } catch (_: Exception) {
      // JS runtime is gone; the next sample will carry the state.
    }
  }

  /** Exposed for tests: the cardinal bucket a heading falls into. */
  internal fun cardinalIndex(heading: Float): Int = (normalize(heading) / 45f).roundToInt() % 8
}

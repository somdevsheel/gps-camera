package com.gpslocationcamera

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.gpslocationcamera.specs.NativeGpsLocationSpec
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Location access built directly on [LocationManager].
 *
 * Google Play Services is intentionally not used: the app must work on
 * de-Googled handsets and with no network at all. Everything reported here
 * comes straight from the OS — no smoothing, no interpolation, no synthesised
 * coordinates.
 */
class LocationModule(private val reactContext: ReactApplicationContext) :
  NativeGpsLocationSpec(reactContext) {

  companion object {
    const val NAME = "GpsLocation"

    private const val EVENT_UPDATE = "GpsLocation:update"
    private const val EVENT_ERROR = "GpsLocation:error"
    private const val EVENT_PROVIDER = "GpsLocation:providerChanged"

    private const val DEFAULT_INTERVAL_MS = 1000L
    private const val DEFAULT_TIMEOUT_MS = 8000L

    /** A fix older than this is considered stale when picking a "best" cached fix. */
    private const val STALE_FIX_MS = 2 * 60 * 1000L
  }

  private val locationManager: LocationManager? =
    reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

  private val handlerThread = HandlerThread("GpsLocationModule").apply { start() }
  private val handler = Handler(handlerThread.looper)
  private val streaming = AtomicBoolean(false)

  private var providerReceiver: BroadcastReceiver? = null

  private val streamListener =
    object : LocationListener {
      override fun onLocationChanged(location: Location) {
        emit(EVENT_UPDATE, serialize(location))
      }

      // Required on API < 30 where the default implementations are absent.
      @Deprecated("Deprecated in API 29")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

      override fun onProviderEnabled(provider: String) = emitProviderStatus()

      override fun onProviderDisabled(provider: String) = emitProviderStatus()
    }

  override fun getName(): String = NAME

  override fun invalidate() {
    stopUpdates()
    unregisterProviderReceiver()
    handlerThread.quitSafely()
    super.invalidate()
  }

  /* ------------------------------------------------------------------ */
  /* Permissions & providers                                             */
  /* ------------------------------------------------------------------ */

  private fun hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED

  private fun hasFine(): Boolean = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)

  private fun hasCoarse(): Boolean = hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)

  private fun hasAnyPermission(): Boolean = hasFine() || hasCoarse()

  private fun isProviderEnabled(provider: String): Boolean =
    try {
      locationManager?.isProviderEnabled(provider) == true
    } catch (_: Exception) {
      false
    }

  private fun providerStatusMap(): WritableMap =
    Arguments.createMap().apply {
      putBoolean("gpsEnabled", isProviderEnabled(LocationManager.GPS_PROVIDER))
      putBoolean("networkEnabled", isProviderEnabled(LocationManager.NETWORK_PROVIDER))
      putBoolean("passiveEnabled", isProviderEnabled(LocationManager.PASSIVE_PROVIDER))
    }

  override fun isLocationEnabled(promise: Promise) {
    val enabled =
      isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    promise.resolve(enabled)
  }

  override fun getProviderStatus(promise: Promise) {
    promise.resolve(providerStatusMap())
  }

  override fun openLocationSettings() {
    val intent =
      Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
    try {
      reactContext.startActivity(intent)
    } catch (_: Exception) {
      // Some ROMs restrict this settings screen; nothing else we can do.
    }
  }

  /* ------------------------------------------------------------------ */
  /* Streaming updates                                                   */
  /* ------------------------------------------------------------------ */

  override fun startUpdates(options: ReadableMap) {
    val manager = locationManager
    if (manager == null) {
      emitError("PROVIDER_UNAVAILABLE", "This device has no location service.")
      return
    }
    if (!hasAnyPermission()) {
      emitError("PERMISSION_DENIED", "Location permission has not been granted.")
      return
    }
    if (!streaming.compareAndSet(false, true)) {
      return
    }

    val highAccuracy = if (options.hasKey("highAccuracy")) options.getBoolean("highAccuracy") else true
    val intervalMs =
      if (options.hasKey("intervalMs")) options.getDouble("intervalMs").toLong()
      else DEFAULT_INTERVAL_MS
    val minDistance =
      if (options.hasKey("minDistanceM")) options.getDouble("minDistanceM").toFloat() else 0f

    // Request from every enabled provider we are allowed to use. The JS layer
    // keeps whichever fix is most recent, and accuracy is always reported so a
    // coarse network fix can never masquerade as a GPS one.
    val providers = mutableListOf<String>()
    if (highAccuracy && hasFine() && isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      providers.add(LocationManager.GPS_PROVIDER)
    }
    if (isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
      providers.add(LocationManager.NETWORK_PROVIDER)
    }
    if (providers.isEmpty() && isProviderEnabled(LocationManager.GPS_PROVIDER) && hasFine()) {
      providers.add(LocationManager.GPS_PROVIDER)
    }

    if (providers.isEmpty()) {
      streaming.set(false)
      emitError("PROVIDER_DISABLED", "No location provider is enabled.")
      return
    }

    if (providers.contains(LocationManager.GPS_PROVIDER)) {
      requestGpsAssistanceRefresh()
    }

    try {
      providers.forEach { provider ->
        manager.requestLocationUpdates(provider, intervalMs, minDistance, streamListener, handlerThread.looper)
      }
      registerProviderReceiver()
    } catch (error: SecurityException) {
      streaming.set(false)
      emitError("PERMISSION_DENIED", error.message ?: "Location permission was revoked.")
    } catch (error: Exception) {
      streaming.set(false)
      emitError("GPS_ERROR", error.message ?: "Could not start location updates.")
    }
  }

  override fun stopUpdates() {
    if (!streaming.compareAndSet(true, false)) {
      return
    }
    try {
      locationManager?.removeUpdates(streamListener)
    } catch (_: Exception) {
      // Already removed.
    }
    unregisterProviderReceiver()
  }

  /* ------------------------------------------------------------------ */
  /* One-shot fixes                                                      */
  /* ------------------------------------------------------------------ */

  override fun getLastKnownPosition(promise: Promise) {
    if (!hasAnyPermission()) {
      promise.resolve(unavailable("PERMISSION_DENIED"))
      return
    }
    val best = bestLastKnown()
    promise.resolve(if (best != null) serialize(best) else unavailable("NO_FIX"))
  }

  /**
   * Requests a position acquired now. Used by verified capture, where a cached
   * fix would misrepresent where the photo was actually taken.
   */
  override fun getCurrentPosition(options: ReadableMap, promise: Promise) {
    val manager = locationManager
    if (manager == null) {
      promise.reject("PROVIDER_UNAVAILABLE", "This device has no location service.")
      return
    }
    if (!hasAnyPermission()) {
      promise.reject("PERMISSION_DENIED", "Location permission has not been granted.")
      return
    }

    val timeoutMs =
      if (options.hasKey("timeoutMs")) options.getDouble("timeoutMs").toLong() else DEFAULT_TIMEOUT_MS
    val maximumAgeMs =
      if (options.hasKey("maximumAgeMs")) options.getDouble("maximumAgeMs").toLong() else 0L
    val highAccuracy =
      if (options.hasKey("highAccuracy")) options.getBoolean("highAccuracy") else true

    // A very recent cached fix is acceptable when the caller allows it.
    if (maximumAgeMs > 0) {
      val cached = bestLastKnown()
      if (cached != null && ageMs(cached) <= maximumAgeMs) {
        promise.resolve(serialize(cached))
        return
      }
    }

    // Race every enabled, permitted provider instead of picking exactly one.
    // Waiting on GPS alone can take 30s+ indoors (cold-start ephemeris
    // acquisition); a network fix typically answers in 1-3s. The live HUD
    // still supersedes this with a better GPS fix moments later, so there is
    // no accuracy cost to taking whichever answers first here.
    val providers = mutableListOf<String>()
    if (highAccuracy && hasFine() && isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      providers.add(LocationManager.GPS_PROVIDER)
    }
    if (isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
      providers.add(LocationManager.NETWORK_PROVIDER)
    }
    if (providers.isEmpty() && isProviderEnabled(LocationManager.GPS_PROVIDER) && hasFine()) {
      providers.add(LocationManager.GPS_PROVIDER)
    }

    if (providers.isEmpty()) {
      promise.reject("PROVIDER_DISABLED", "No usable location provider is enabled.")
      return
    }

    if (providers.contains(LocationManager.GPS_PROVIDER)) {
      requestGpsAssistanceRefresh()
    }

    val settled = AtomicBoolean(false)
    val remainingProviders = AtomicInteger(providers.size)
    val listeners = LinkedHashMap<String, LocationListener>()

    fun cleanup() {
      listeners.values.forEach { listener ->
        try {
          locationManager?.removeUpdates(listener)
        } catch (_: Exception) {
          // Ignored.
        }
      }
    }

    val timeoutRunnable = Runnable {
      if (settled.compareAndSet(false, true)) {
        cleanup()
        promise.reject("GPS_TIMEOUT", "Timed out waiting for a fresh position.")
      }
    }

    providers.forEach { provider ->
      listeners[provider] =
        object : LocationListener {
          override fun onLocationChanged(location: Location) {
            if (settled.compareAndSet(false, true)) {
              handler.removeCallbacks(timeoutRunnable)
              cleanup()
              promise.resolve(serialize(location))
            }
          }

          @Deprecated("Deprecated in API 29")
          override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

          override fun onProviderEnabled(provider: String) = Unit

          override fun onProviderDisabled(provider: String) {
            // Only fail outright once every provider still in the race is gone;
            // one going down mid-flight just leaves the others to answer.
            if (remainingProviders.decrementAndGet() <= 0 && settled.compareAndSet(false, true)) {
              handler.removeCallbacks(timeoutRunnable)
              cleanup()
              promise.reject("PROVIDER_DISABLED", "The location provider was turned off.")
            }
          }
        }
    }

    try {
      listeners.forEach { (provider, listener) ->
        manager.requestLocationUpdates(provider, 0L, 0f, listener, handlerThread.looper)
      }
      handler.postDelayed(timeoutRunnable, timeoutMs)
    } catch (error: SecurityException) {
      settled.set(true)
      cleanup()
      promise.reject("PERMISSION_DENIED", error.message ?: "Location permission was revoked.")
    } catch (error: Exception) {
      settled.set(true)
      cleanup()
      promise.reject("GPS_ERROR", error.message ?: "Could not request a position.")
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private fun ageMs(location: Location): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
      (SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos) / 1_000_000L
    } else {
      System.currentTimeMillis() - location.time
    }

  /** Picks the most trustworthy cached fix: freshest first, then most accurate. */
  private fun bestLastKnown(): Location? {
    val manager = locationManager ?: return null
    val candidates =
      listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        .mapNotNull { provider ->
          try {
            manager.getLastKnownLocation(provider)
          } catch (_: SecurityException) {
            null
          } catch (_: Exception) {
            null
          }
        }
    if (candidates.isEmpty()) {
      return null
    }
    val fresh = candidates.filter { ageMs(it) <= STALE_FIX_MS }
    val pool = fresh.ifEmpty { candidates }
    return pool.minByOrNull { if (it.hasAccuracy()) it.accuracy else Float.MAX_VALUE }
  }

  /**
   * Nudges the GNSS chip to refresh its assistance data (satellite
   * ephemeris/almanac + network time) before a GPS fix is requested. This is
   * what usually turns a 30-60s cold-start lock into a handful of seconds
   * when the device has network connectivity - the chip downloads predicted
   * satellite positions over the network instead of waiting to decode them
   * one-by-one off the signal itself.
   *
   * [LocationManager.sendExtraCommand] is deprecated on the framework
   * surface, but most vendor GNSS HALs (Qualcomm, MediaTek, Samsung, ...)
   * still honor these two commands. Best-effort only: a stack that ignores
   * them just leaves GPS acquisition exactly as it was.
   */
  private fun requestGpsAssistanceRefresh() {
    try {
      @Suppress("DEPRECATION")
      locationManager?.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_xtra_injection", null)
      @Suppress("DEPRECATION")
      locationManager?.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_time_injection", null)
    } catch (_: Exception) {
      // Ignored - unsupported on this device.
    }
  }

  private fun isMocked(location: Location): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      location.isMock
    } else {
      @Suppress("DEPRECATION")
      location.isFromMockProvider
    }

  private fun serialize(location: Location): WritableMap =
    Arguments.createMap().apply {
      putBoolean("ok", true)
      putDouble("latitude", location.latitude)
      putDouble("longitude", location.longitude)
      if (location.hasAccuracy()) putDouble("accuracy", location.accuracy.toDouble())
      if (location.hasAltitude()) putDouble("altitude", location.altitude)
      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasVerticalAccuracy()
      ) {
        putDouble("altitudeAccuracy", location.verticalAccuracyMeters.toDouble())
      }
      if (location.hasSpeed()) putDouble("speed", location.speed.toDouble())
      if (location.hasBearing()) putDouble("bearing", location.bearing.toDouble())
      putDouble("gpsTimestamp", location.time.toDouble())
      putString("provider", location.provider ?: "unknown")
      // Fine location was never granted, so every coordinate is deliberately fuzzed by the OS.
      putBoolean("isCoarse", !hasFine())
      putBoolean("mocked", isMocked(location))
    }

  private fun unavailable(code: String): WritableMap =
    Arguments.createMap().apply {
      putBoolean("ok", false)
      putString("code", code)
    }

  private fun emit(event: String, payload: WritableMap) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    try {
      reactContext.emitDeviceEvent(event, payload)
    } catch (_: Exception) {
      // The JS runtime went away mid-emit; the next update will carry the state.
    }
  }

  private fun emitError(code: String, message: String) {
    emit(
      EVENT_ERROR,
      Arguments.createMap().apply {
        putString("code", code)
        putString("message", message)
      },
    )
  }

  private fun emitProviderStatus() {
    emit(EVENT_PROVIDER, providerStatusMap())
  }

  private fun registerProviderReceiver() {
    if (providerReceiver != null) {
      return
    }
    val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          emitProviderStatus()
        }
      }
    providerReceiver = receiver
    try {
      ContextCompat.registerReceiver(
        reactContext,
        receiver,
        IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION),
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
    } catch (_: Exception) {
      providerReceiver = null
    }
  }

  private fun unregisterProviderReceiver() {
    val receiver = providerReceiver ?: return
    providerReceiver = null
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: Exception) {
      // Already unregistered.
    }
  }
}

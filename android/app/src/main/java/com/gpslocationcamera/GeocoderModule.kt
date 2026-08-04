package com.gpslocationcamera

import android.location.Address
import android.location.Geocoder
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.gpslocationcamera.specs.NativeGpsGeocoderSpec
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reverse geocoding through the platform [Geocoder].
 *
 * This keeps coordinates on the device and out of any third-party API. It can
 * fail (no backing service, or no connectivity) — in that case we resolve with
 * `ok: false` rather than rejecting, because a missing address must never stop
 * a capture.
 */
class GeocoderModule(private val reactContext: ReactApplicationContext) :
  NativeGpsGeocoderSpec(reactContext) {

  companion object {
    const val NAME = "GpsGeocoder"
  }

  // Single worker: geocoding is IO-bound and we never want more than one in
  // flight competing for the same backing service.
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  override fun isPresent(promise: Promise) {
    promise.resolve(Geocoder.isPresent())
  }

  override fun reverseGeocode(latitude: Double, longitude: Double, promise: Promise) {
    if (!Geocoder.isPresent()) {
      promise.resolve(failure("GEOCODER_UNAVAILABLE"))
      return
    }

    val geocoder = Geocoder(reactContext, Locale.getDefault())
    val settled = AtomicBoolean(false)

    fun resolveOnce(result: WritableMap) {
      if (settled.compareAndSet(false, true)) {
        promise.resolve(result)
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      // API 33+ provides a non-blocking callback API.
      try {
        geocoder.getFromLocation(
          latitude,
          longitude,
          1,
          object : Geocoder.GeocodeListener {
            override fun onGeocode(addresses: MutableList<Address>) {
              resolveOnce(addresses.firstOrNull()?.let(::serialize) ?: failure("NO_RESULT"))
            }

            override fun onError(errorMessage: String?) {
              resolveOnce(failure("GEOCODER_ERROR"))
            }
          },
        )
      } catch (_: Exception) {
        resolveOnce(failure("GEOCODER_ERROR"))
      }
      return
    }

    // Older API levels only offer the blocking call, so it runs off the JS thread.
    executor.execute {
      val result =
        try {
          @Suppress("DEPRECATION")
          val addresses = geocoder.getFromLocation(latitude, longitude, 1)
          addresses?.firstOrNull()?.let(::serialize) ?: failure("NO_RESULT")
        } catch (_: Exception) {
          // Almost always "grpc failed" / no connectivity.
          failure("GEOCODER_ERROR")
        }
      resolveOnce(result)
    }
  }

  private fun serialize(address: Address): WritableMap =
    Arguments.createMap().apply {
      putBoolean("ok", true)
      address.featureName?.let { putString("featureName", it) }
      address.thoroughfare?.let { putString("street", it) }
      address.subLocality?.let { putString("subLocality", it) }
      address.locality?.let { putString("locality", it) }
      address.subAdminArea?.let { putString("subAdminArea", it) }
      address.adminArea?.let { putString("adminArea", it) }
      address.postalCode?.let { putString("postalCode", it) }
      address.countryName?.let { putString("countryName", it) }
      address.countryCode?.let { putString("countryCode", it) }
      val lines = (0..address.maxAddressLineIndex).mapNotNull { address.getAddressLine(it) }
      if (lines.isNotEmpty()) {
        putString("formatted", lines.joinToString(", "))
      }
    }

  private fun failure(code: String): WritableMap =
    Arguments.createMap().apply {
      putBoolean("ok", false)
      putString("code", code)
    }
}

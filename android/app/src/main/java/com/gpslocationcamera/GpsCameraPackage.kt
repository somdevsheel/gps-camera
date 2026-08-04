package com.gpslocationcamera

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers every native module this app owns.
 *
 * All modules are TurboModules generated from the TypeScript specs in
 * `src/specs`, so the JS side is type-checked against the same contract the
 * Kotlin implementations satisfy.
 */
class GpsCameraPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      LocationModule.NAME -> LocationModule(reactContext)
      CompassModule.NAME -> CompassModule(reactContext)
      GeocoderModule.NAME -> GeocoderModule(reactContext)
      ImageModule.NAME -> ImageModule(reactContext)
      MediaModule.NAME -> MediaModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    listOf(
        LocationModule.NAME,
        CompassModule.NAME,
        GeocoderModule.NAME,
        ImageModule.NAME,
        MediaModule.NAME,
      )
      .associateWith { name ->
        ReactModuleInfo(
          name,
          name,
          /* canOverrideExistingModule = */ false,
          /* needsEagerInit = */ false,
          /* isCxxModule = */ false,
          /* isTurboModule = */ true,
        )
      }
  }
}

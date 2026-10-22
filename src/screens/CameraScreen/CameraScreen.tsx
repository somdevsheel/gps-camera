import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type TargetCameraPosition,
  type FlashMode,
} from 'react-native-vision-camera';
import {Colors, GPS, Radius, Spacing} from '../../constants';
import type {RootStackParamList} from '../../navigation/types';
import {useAppActive} from '../../hooks/useAppActive';
import {useCompassTracking} from '../../hooks/useCompassTracking';
import {useLocationTracking} from '../../hooks/useLocationTracking';
import {usePermissions} from '../../hooks/usePermissions';
import {useReverseGeocode} from '../../hooks/useReverseGeocode';
import {useGpsStore} from '../../store/gpsStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useCaptureStore} from '../../store/captureStore';
import {captureService, type CaptureStage} from '../../services/camera/CaptureService';
import {locationService} from '../../services/location/LocationService';
import {Banner} from '../../components/Banner';
import {ControlButton} from '../../components/ControlButton';
import {GpsStatusPill} from '../../components/GpsStatusPill';
import {InfoPanel} from '../../components/InfoPanel';
import {PermissionGate} from '../../components/PermissionGate';
import {ShutterButton} from '../../components/ShutterButton';
import {log} from '../../utils/logger';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];

/**
 * Camera control calls (torch, zoom, exposure) briefly reject during normal
 * lifecycle transitions - the session pausing/resuming as the screen loses
 * focus, the app backgrounding, an unsupported camera being asked for torch.
 * These self-recover and aren't anything the user needs to know about, so
 * they're logged and swallowed instead of shown.
 */
const BENIGN_CAMERA_ERROR = /torch|not active|operationcanceled|session is not running/i;

/** Generic, non-technical copy for the rare camera error that IS worth surfacing. */
const CAMERA_ERROR_MESSAGE =
  'The camera is temporarily unavailable. Try closing and reopening this screen.';

const STAGE_LABEL: Record<CaptureStage | 'capturing', string> = {
  capturing: 'Capturing…',
  locating: 'Acquiring GPS…',
  geocoding: 'Resolving address…',
  hashing: 'Hashing image…',
  stamping: 'Stamping photo…',
  saving: 'Saving…',
  done: 'Done',
};

export function CameraScreen(): React.ReactElement {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const appActive = useAppActive();

  const settings = useSettingsStore(state => state.settings);
  const gps = useGpsStore(state => state.gps);
  const geocode = useGpsStore(state => state.geocode);
  const compass = useGpsStore(state => state.compass);

  const addRecord = useCaptureStore(state => state.addRecord);

  const {snapshot, checking, requestAll, refresh, openSettings} = usePermissions();
  const {hasPermission: hasCameraPermission, requestPermission: requestCameraPermission} =
    useCameraPermission();

  const [position, setPosition] = useState<TargetCameraPosition>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CaptureStage | 'capturing' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());

  const capturing = useRef(false);

  // Screen is "live" only while focused AND in the foreground; this drives the
  // camera session, GPS stream and sensors so nothing runs in the background.
  const live = isFocused && appActive;
  const locationGranted =
    snapshot?.fineLocation === 'granted' || snapshot?.coarseLocation === 'granted';

  // Wait for the first permission snapshot; until then "not granted" only means
  // "not checked yet" and would flash the permission-denied banner on launch.
  useLocationTracking(live && snapshot !== null, Boolean(locationGranted));
  useCompassTracking(live, settings.showCompass);
  useReverseGeocode(live, settings.showAddress);

  const device = useCameraDevice(position);
  // Front cameras (and some back ones) have no flash unit at all; asking the
  // native controller for torch on those throws, so never request it there.
  const torchAvailable = device?.hasTorch ?? false;
  const photoOutput = usePhotoOutput({
    qualityPrioritization: settings.imageQuality === 'high' ? 'quality' : 'balanced',
    quality: settings.imageQuality === 'compact' ? 0.8 : 0.95,
  });

  /* Live clock for the HUD; only ticks while the screen is visible. */
  useEffect(() => {
    if (!live) {
      return;
    }
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  /* Re-check permissions whenever the screen regains focus (user may have
     changed them in system settings). */
  useEffect(() => {
    if (live) {
      void refresh();
    }
  }, [live, refresh]);

  /* Torch is a hardware resource: never leave it on when we lose focus, and
     never leave it "on" for a device (e.g. the front camera) that can't
     actually drive it - the native controller rejects that call. */
  useEffect(() => {
    if (torch && (!live || !torchAvailable)) {
      setTorch(false);
    }
  }, [live, torch, torchAvailable]);

  const zoomPresets = useMemo(() => {
    if (!device) {
      return [1];
    }
    const factors = device.zoomLensSwitchFactors?.length
      ? device.zoomLensSwitchFactors
      : [1, 2];
    const unique = Array.from(new Set([device.minZoom, ...factors]))
      .filter(value => value >= device.minZoom && value <= device.maxZoom)
      .sort((a, b) => a - b);
    return unique.length > 0 ? unique : [1];
  }, [device]);

  useEffect(() => {
    const first = zoomPresets[0];
    if (first !== undefined && !zoomPresets.includes(zoom)) {
      setZoom(first);
    }
  }, [zoomPresets, zoom]);

  const handleRequestPermissions = useCallback(async () => {
    if (!hasCameraPermission) {
      await requestCameraPermission();
    }
    await requestAll();
  }, [hasCameraPermission, requestCameraPermission, requestAll]);

  const cycleFlash = useCallback(() => {
    setFlash(current => {
      const index = FLASH_CYCLE.indexOf(current);
      return FLASH_CYCLE[(index + 1) % FLASH_CYCLE.length] ?? 'off';
    });
  }, []);

  const handleCapture = useCallback(async () => {
    if (capturing.current || !photoOutput) {
      return;
    }
    capturing.current = true;
    setBusy(true);
    setStage('capturing');

    try {
      const file = await photoOutput.capturePhotoToFile(
        {flashMode: flash, enableShutterSound: true},
        {},
      );

      const state = useGpsStore.getState();
      const result = await captureService.process(
        {
          photoPath: file.filePath,
          width: 0,
          height: 0,
          settings,
          cachedFix: state.gps.fix,
          compass: state.compass,
          cachedGeocode: state.geocode,
        },
        progress => setStage(progress.stage),
      );

      if (!result.ok) {
        Alert.alert('Capture failed', result.message);
        return;
      }

      addRecord(result.value.record);
      navigation.navigate('Preview', {
        captureId: result.value.record.captureId,
        warnings: result.value.warnings,
      });
    } catch (error) {
      log.error('CameraScreen', 'capture failed', error);
      Alert.alert(
        'Capture failed',
        error instanceof Error ? error.message : 'The camera could not take a photo.',
      );
    } finally {
      capturing.current = false;
      setBusy(false);
      setStage(null);
    }
  }, [photoOutput, flash, settings, addRecord, navigation]);

  const handleGpsPress = useCallback(() => {
    if (gps.phase === 'disabled') {
      locationService.openSettings();
      return;
    }
    if (gps.phase === 'permission-denied') {
      void handleRequestPermissions();
    }
  }, [gps.phase, handleRequestPermissions]);

  if (checking && !snapshot) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (snapshot && (!hasCameraPermission || snapshot.camera !== 'granted')) {
    return (
      <PermissionGate
        snapshot={snapshot}
        busy={checking}
        onRequest={handleRequestPermissions}
        onOpenSettings={openSettings}
      />
    );
  }

  return (
    <View style={styles.container}>
      {device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={[photoOutput]}
          isActive={live}
          zoom={zoom}
          torchMode={torch && torchAvailable ? 'on' : 'off'}
          enableNativeTapToFocusGesture
          resizeMode="cover"
          onError={error => {
            log.error('CameraScreen', 'camera error', error);
            if (BENIGN_CAMERA_ERROR.test(error.message)) {
              setTorch(false);
              return;
            }
            // Never surface the raw native message (exception class names,
            // stack traces) to end users - just the friendly summary.
            setCameraError(CAMERA_ERROR_MESSAGE);
          }}
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.errorText}>No {position} camera is available on this device.</Text>
        </View>
      )}

      {/* Top chrome */}
      <View style={[styles.topBar, {paddingTop: insets.top + Spacing.sm}]}>
        <View style={styles.statusSlot}>
          <GpsStatusPill gps={gps} onPress={handleGpsPress} />
        </View>
        <View style={styles.topActions}>
          <ControlButton
            icon={flash === 'off' ? 'flashOff' : 'flashOn'}
            label={`Flash ${flash}`}
            badge={flash.toUpperCase()}
            active={flash !== 'off'}
            onPress={cycleFlash}
          />
          <ControlButton
            icon="settings"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>

      {/* Bottom chrome */}
      <View style={[styles.bottom, {paddingBottom: insets.bottom + Spacing.lg}]}>
        {cameraError ? (
          <Banner
            tone="danger"
            title="Camera error"
            message={cameraError}
            actionLabel="Dismiss"
            onAction={() => setCameraError(null)}
          />
        ) : null}

        {gps.phase === 'disabled' ? (
          <Banner
            tone="warning"
            title="Location is turned off"
            message="Photos will be stamped without coordinates."
            actionLabel="Turn on"
            onAction={() => locationService.openSettings()}
          />
        ) : null}

        {gps.phase === 'permission-denied' ? (
          <Banner
            tone="warning"
            title="Location permission denied"
            message="Grant location access to stamp coordinates."
            actionLabel="Grant"
            onAction={handleRequestPermissions}
          />
        ) : null}

        <InfoPanel
          gps={gps}
          geocode={geocode}
          compass={compass}
          settings={settings}
          now={clock}
        />

        {zoomPresets.length > 1 ? (
          <View style={styles.zoomRow}>
            {zoomPresets.map(preset => (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityLabel={`Zoom ${preset}x`}
                accessibilityState={{selected: zoom === preset}}
                onPress={() => setZoom(preset)}
                style={[styles.zoomChip, zoom === preset && styles.zoomChipActive]}>
                <Text style={[styles.zoomText, zoom === preset && styles.zoomTextActive]}>
                  {preset % 1 === 0 ? `${preset}×` : `${preset.toFixed(1)}×`}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {stage ? <Text style={styles.stage}>{STAGE_LABEL[stage]}</Text> : null}

        <View style={styles.shutterRow}>
          <ControlButton
            icon="gallery"
            label="Open gallery"
            onPress={() => navigation.navigate('Gallery')}
          />
          <ShutterButton
            onPress={handleCapture}
            busy={busy}
            disabled={!device}
            verified={settings.verifiedCaptureMode && gps.phase === 'ready'}
          />
          <View style={styles.rightControls}>
            <ControlButton
              icon="flip"
              label="Switch camera"
              onPress={() => setPosition(current => (current === 'back' ? 'front' : 'back'))}
            />
            <ControlButton
              icon="torch"
              label={torch ? 'Turn torch off' : 'Turn torch on'}
              active={torch}
              disabled={!torchAvailable}
              onPress={() => setTorch(current => !current)}
            />
          </View>
        </View>

        {settings.verifiedCaptureMode ? (
          <Text style={styles.verifiedHint}>
            Verified capture on — a fresh fix is taken at the moment of capture (up to{' '}
            {Math.round(GPS.CAPTURE_TIMEOUT_MS / 1000)}s).
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  errorText: {color: Colors.textMuted, textAlign: 'center'},
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  statusSlot: {flex: 1, minWidth: 0},
  topActions: {flexDirection: 'row', gap: Spacing.sm},
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  zoomRow: {flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm},
  zoomChip: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  zoomChipActive: {backgroundColor: Colors.accent, borderColor: Colors.accent},
  zoomText: {color: Colors.text, fontSize: 12, fontWeight: '700'},
  zoomTextActive: {color: Colors.background},
  stage: {color: Colors.accent, fontSize: 12, textAlign: 'center', fontWeight: '600'},
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rightControls: {flexDirection: 'row', gap: Spacing.sm},
  verifiedHint: {
    color: Colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});

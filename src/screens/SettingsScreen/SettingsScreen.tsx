import React, {useCallback} from 'react';
import {Alert, ScrollView, StyleSheet, Text} from 'react-native';
import type {
  CoordinateFormat,
  DateFormat,
  ImageQuality,
  StampPosition,
  StampStyle,
  TextSize,
  TimeFormat,
} from '../../types';
import {APP_NAME, Colors, Spacing} from '../../constants';
import {useSettingsStore} from '../../store/settingsStore';
import {geocodingService} from '../../services/geocoding/GeocodingService';
import {SectionCard} from '../../components/SectionCard';
import {
  SettingLink,
  SettingOptions,
  SettingSwitch,
  SettingText,
} from '../../components/SettingRow';

const STAMP_STYLES: ReadonlyArray<{value: StampStyle; label: string}> = [
  {value: 'classic', label: 'Classic'},
  {value: 'compact', label: 'Compact'},
  {value: 'detailed', label: 'Detailed'},
  {value: 'minimal', label: 'Minimal'},
];

const POSITIONS: ReadonlyArray<{value: StampPosition; label: string}> = [
  {value: 'bottom', label: 'Bottom'},
  {value: 'top', label: 'Top'},
];

const TEXT_SIZES: ReadonlyArray<{value: TextSize; label: string}> = [
  {value: 'small', label: 'Small'},
  {value: 'medium', label: 'Medium'},
  {value: 'large', label: 'Large'},
];

const DATE_FORMATS: ReadonlyArray<{value: DateFormat; label: string}> = [
  {value: 'DD MMM YYYY', label: '04 Aug 2026'},
  {value: 'DD/MM/YYYY', label: '04/08/2026'},
  {value: 'MM/DD/YYYY', label: '08/04/2026'},
  {value: 'YYYY-MM-DD', label: '2026-08-04'},
];

const TIME_FORMATS: ReadonlyArray<{value: TimeFormat; label: string}> = [
  {value: '12h', label: '12-hour'},
  {value: '24h', label: '24-hour'},
];

const COORDINATE_FORMATS: ReadonlyArray<{value: CoordinateFormat; label: string}> = [
  {value: 'decimal', label: '29.218300° N'},
  {value: 'dms', label: "29° 13' 05.88\" N"},
  {value: 'decimal-signed', label: '29.218300'},
];

const QUALITIES: ReadonlyArray<{value: ImageQuality; label: string}> = [
  {value: 'high', label: 'High'},
  {value: 'balanced', label: 'Balanced'},
  {value: 'compact', label: 'Compact'},
];

export function SettingsScreen(): React.ReactElement {
  const settings = useSettingsStore(state => state.settings);
  const update = useSettingsStore(state => state.update);
  const reset = useSettingsStore(state => state.reset);

  const handleReset = useCallback(() => {
    Alert.alert('Reset settings', 'Restore every setting to its default value?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Reset', style: 'destructive', onPress: reset},
    ]);
  }, [reset]);

  const handleClearCache = useCallback(() => {
    geocodingService.clearCache();
    Alert.alert('Cache cleared', 'Stored address lookups have been removed from this device.');
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <SectionCard title="Stamp appearance">
        <SettingOptions
          label="Stamp style"
          value={settings.stampStyle}
          options={STAMP_STYLES}
          onChange={value => update('stampStyle', value)}
        />
        <SettingOptions
          label="Stamp position"
          value={settings.stampPosition}
          options={POSITIONS}
          onChange={value => update('stampPosition', value)}
        />
        <SettingOptions
          label="Text size"
          value={settings.textSize}
          options={TEXT_SIZES}
          onChange={value => update('textSize', value)}
        />
      </SectionCard>

      <SectionCard title="Formats">
        <SettingOptions
          label="Date format"
          value={settings.dateFormat}
          options={DATE_FORMATS}
          onChange={value => update('dateFormat', value)}
        />
        <SettingOptions
          label="Time format"
          value={settings.timeFormat}
          options={TIME_FORMATS}
          onChange={value => update('timeFormat', value)}
        />
        <SettingOptions
          label="Coordinate format"
          value={settings.coordinateFormat}
          options={COORDINATE_FORMATS}
          onChange={value => update('coordinateFormat', value)}
        />
      </SectionCard>

      <SectionCard
        title="Stamp contents"
        footnote="Fields with no data are printed as unavailable rather than hidden, so a stamp never implies information it does not have.">
        <SettingSwitch
          label="Address"
          description="Reverse-geocoded street address"
          value={settings.showAddress}
          onValueChange={value => update('showAddress', value)}
        />
        <SettingSwitch
          label="GPS accuracy"
          value={settings.showAccuracy}
          onValueChange={value => update('showAccuracy', value)}
        />
        <SettingSwitch
          label="Altitude"
          value={settings.showAltitude}
          onValueChange={value => update('showAltitude', value)}
        />
        <SettingSwitch
          label="Speed"
          value={settings.showSpeed}
          onValueChange={value => update('showSpeed', value)}
        />
        <SettingSwitch
          label="Compass direction"
          value={settings.showCompass}
          onValueChange={value => update('showCompass', value)}
        />
        <SettingSwitch
          label="Map preview"
          description="Adds a small map thumbnail. Needs a connection; falls back to text-only."
          value={settings.showMap}
          onValueChange={value => update('showMap', value)}
        />
      </SectionCard>

      <SectionCard title="Field data">
        <SettingText
          label="Company name"
          value={settings.companyName}
          placeholder="Optional"
          onChangeText={value => update('companyName', value)}
        />
        <SettingText
          label="Project name"
          value={settings.projectName}
          placeholder="Optional"
          onChangeText={value => update('projectName', value)}
        />
        <SettingText
          label="Custom note"
          value={settings.customNote}
          placeholder="Optional"
          maxLength={120}
          onChangeText={value => update('customNote', value)}
        />
      </SectionCard>

      <SectionCard
        title="Capture integrity"
        footnote="Verified capture takes a fresh GPS fix at the moment of capture and records SHA-256 hashes of both the original and stamped images. Coarse or mocked positions are never labelled verified.">
        <SettingSwitch
          label="Verified capture mode"
          value={settings.verifiedCaptureMode}
          onValueChange={value => update('verifiedCaptureMode', value)}
        />
        <SettingSwitch
          label="High-accuracy GPS"
          description="Prefers the GPS provider over network positioning"
          value={settings.highAccuracyGps}
          onValueChange={value => update('highAccuracyGps', value)}
        />
        <SettingSwitch
          label="Write EXIF metadata"
          description="Embeds GPS, timestamp and app name into the exported file"
          value={settings.writeExif}
          onValueChange={value => update('writeExif', value)}
        />
      </SectionCard>

      <SectionCard title="Storage">
        <SettingSwitch
          label="Save stamped photo"
          value={settings.saveStamped}
          onValueChange={value => update('saveStamped', value)}
        />
        <SettingSwitch
          label="Keep original photo"
          description="Stores the unstamped image alongside the stamped one"
          value={settings.saveOriginal}
          onValueChange={value => update('saveOriginal', value)}
        />
        <SettingSwitch
          label="Export to device gallery"
          value={settings.saveToGallery}
          onValueChange={value => update('saveToGallery', value)}
        />
        <SettingOptions
          label="Image quality"
          value={settings.imageQuality}
          options={QUALITIES}
          onChange={value => update('imageQuality', value)}
        />
      </SectionCard>

      <SectionCard
        title="Privacy"
        footnote="Photos, coordinates and capture records stay on this device. There is no account, no analytics and no upload. Map tiles are the only network request the app makes, and only when the map stamp is enabled.">
        <SettingLink
          label="Clear cached addresses"
          description="Removes locally stored reverse-geocoding results"
          onPress={handleClearCache}
        />
        <SettingLink label="Reset all settings" onPress={handleReset} danger />
      </SectionCard>

      <Text style={styles.version}>{APP_NAME} · MVP build</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  version: {color: Colors.textFaint, fontSize: 11, textAlign: 'center'},
});

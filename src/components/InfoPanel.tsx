import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {AppSettings, CompassReading, GeocodeResult, GpsState} from '../types';
import {Colors, Radius, Spacing} from '../constants';
import {
  formatAltitude,
  formatDate,
  formatLatitude,
  formatLongitude,
  formatShortAddress,
  formatTime,
} from '../utils/format';

interface InfoPanelProps {
  gps: GpsState;
  geocode: GeocodeResult | null;
  compass: CompassReading | null;
  settings: AppSettings;
  now: number;
}

function addressText(geocode: GeocodeResult | null, showAddress: boolean): string {
  if (!showAddress) {
    return '';
  }
  switch (geocode?.status) {
    case 'ok':
      return formatShortAddress(geocode.address) ?? 'Address unavailable';
    case 'loading':
      return 'Resolving address…';
    case 'unavailable':
      return 'Address lookup unavailable offline';
    case 'no-result':
      return 'No address for these coordinates';
    case 'error':
      return 'Address lookup failed';
    default:
      return '';
  }
}

/**
 * Semi-transparent HUD above the shutter. Memoised and fed only the values it
 * renders, so a heading tick does not repaint the whole camera tree.
 */
export const InfoPanel = memo(function InfoPanel({
  gps,
  geocode,
  compass,
  settings,
  now,
}: InfoPanelProps) {
  const fix = gps.fix;
  const address = addressText(geocode, settings.showAddress);

  return (
    <View style={styles.panel} accessibilityLabel="Capture information">
      {address ? (
        <Text style={styles.address} numberOfLines={2}>
          {address}
        </Text>
      ) : null}

      {fix ? (
        <View style={styles.row}>
          <Text style={styles.value}>{formatLatitude(fix.latitude, settings.coordinateFormat)}</Text>
          <Text style={styles.value}>{formatLongitude(fix.longitude, settings.coordinateFormat)}</Text>
        </View>
      ) : (
        <Text style={styles.muted}>Coordinates unavailable</Text>
      )}

      <View style={styles.row}>
        <Text style={styles.muted}>
          {formatDate(now, settings.dateFormat)} · {formatTime(now, settings.timeFormat)}
        </Text>
        {settings.showAltitude && fix?.altitude !== null && fix?.altitude !== undefined ? (
          <Text style={styles.muted}>Alt {formatAltitude(fix.altitude)}</Text>
        ) : null}
        {settings.showCompass && compass ? (
          <Text style={styles.muted}>
            {compass.cardinal} {Math.round(compass.heading)}°
          </Text>
        ) : null}
      </View>

      {fix?.isCoarse ? (
        <Text style={styles.warning}>Approximate location only — enable precise location</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.panel,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 2,
  },
  address: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
  },
  value: {
    color: Colors.text,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  muted: {
    color: Colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    color: Colors.warning,
    fontSize: 11,
    marginTop: 2,
  },
});

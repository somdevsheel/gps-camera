import React, {memo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {GpsQuality, GpsState} from '../types';
import {Colors, Radius, Spacing} from '../constants';
import {formatAccuracy} from '../utils/format';

interface GpsStatusPillProps {
  gps: GpsState;
  onPress?: () => void;
}

const QUALITY_COLOR: Record<GpsQuality, string> = {
  none: Colors.textFaint,
  poor: Colors.danger,
  fair: Colors.warning,
  good: Colors.success,
  excellent: Colors.accent,
};

/** Compact GPS state chip: dot + phase label + accuracy. */
export const GpsStatusPill = memo(function GpsStatusPillImpl({gps, onPress}: GpsStatusPillProps) {
  const {phase, quality, fix, message} = gps;
  const color = phase === 'ready' ? QUALITY_COLOR[quality] : Colors.warning;
  const label =
    phase === 'ready' && fix
      ? `GPS ready · ${formatAccuracy(fix.accuracy)}`
      : message;

  const content = (
    <View style={styles.pill}>
      <View style={[styles.dot, {backgroundColor: color}]} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`GPS status: ${label}`}
      onPress={onPress}
      style={({pressed}) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    maxWidth: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  label: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});

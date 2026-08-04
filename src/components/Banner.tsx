import React, {memo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Colors, Radius, Spacing} from '../constants';

type Tone = 'info' | 'warning' | 'danger' | 'success';

interface BannerProps {
  tone?: Tone;
  title: string;
  message?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}

const TONE_COLOR: Record<Tone, string> = {
  info: Colors.accent,
  warning: Colors.warning,
  danger: Colors.danger,
  success: Colors.success,
};

/** Inline non-blocking notice used for degraded states and capture warnings. */
export const Banner = memo(function Banner({
  tone = 'info',
  title,
  message,
  actionLabel,
  onAction,
}: BannerProps) {
  return (
    <View style={[styles.container, {borderLeftColor: TONE_COLOR[tone]}]} accessibilityRole="alert">
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {message ? (
          <Text style={styles.message} numberOfLines={4} ellipsizeMode="tail">
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={onAction}
          style={({pressed}) => pressed && styles.pressed}>
          <Text style={[styles.action, {color: TONE_COLOR[tone]}]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  textWrap: {flex: 1},
  title: {color: Colors.text, fontSize: 13, fontWeight: '700'},
  message: {color: Colors.textMuted, fontSize: 12, marginTop: 2},
  action: {fontSize: 13, fontWeight: '700'},
  pressed: {opacity: 0.7},
});

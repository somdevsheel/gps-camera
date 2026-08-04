import React, {memo} from 'react';
import {Pressable, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {Colors, HIT_TARGET, Radius} from '../constants';
import {Icon, type GlyphName} from './Icon';

interface ControlButtonProps {
  icon: GlyphName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: string | null;
  style?: ViewStyle;
}

/** Round translucent control used along the camera chrome. */
export const ControlButton = memo(function ControlButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  badge = null,
  style,
}: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled, selected: active}}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        active && styles.active,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <Icon name={icon} size={20} color={active ? Colors.background : Colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,22,28,0.75)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  active: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  badgeText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
});

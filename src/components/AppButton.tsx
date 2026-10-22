import React, {memo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle} from 'react-native';
import {Colors, HIT_TARGET, Radius, Spacing} from '../constants';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}

export const AppButton = memo(function AppButtonImpl({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  style,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{disabled: disabled || busy, busy}}
      disabled={disabled || busy}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? Colors.background : Colors.text} />
      ) : (
        <Text style={[styles.label, variant === 'primary' && styles.labelPrimary]}>{title}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_TARGET,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {backgroundColor: Colors.accent},
  secondary: {backgroundColor: Colors.surfaceAlt},
  danger: {backgroundColor: Colors.danger},
  ghost: {backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border},
  pressed: {opacity: 0.75},
  disabled: {opacity: 0.45},
  label: {color: Colors.text, fontSize: 15, fontWeight: '700'},
  labelPrimary: {color: Colors.background},
});

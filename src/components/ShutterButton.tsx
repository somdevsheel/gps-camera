import React, {memo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {Colors} from '../constants';

interface ShutterButtonProps {
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  verified?: boolean;
}

const SIZE = 78;

/** Large circular shutter; stays enabled even when GPS is still searching. */
export const ShutterButton = memo(function ShutterButton({
  onPress,
  busy,
  disabled = false,
  verified = false,
}: ShutterButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Processing photo' : 'Take photo'}
      accessibilityState={{disabled: disabled || busy, busy}}
      disabled={disabled || busy}
      onPress={onPress}
      style={({pressed}) => [styles.outer, pressed && styles.pressed]}>
      <View
        style={[
          styles.ring,
          verified && styles.ringVerified,
          (disabled || busy) && styles.ringDisabled,
        ]}>
        {busy ? (
          <ActivityIndicator color={Colors.background} size="small" />
        ) : (
          <View style={[styles.inner, verified && styles.innerVerified]} />
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  outer: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{scale: 0.94}],
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringVerified: {
    borderColor: Colors.accent,
  },
  ringDisabled: {
    borderColor: Colors.textFaint,
  },
  inner: {
    width: SIZE - 18,
    height: SIZE - 18,
    borderRadius: (SIZE - 18) / 2,
    backgroundColor: Colors.text,
  },
  innerVerified: {
    backgroundColor: Colors.accent,
  },
});

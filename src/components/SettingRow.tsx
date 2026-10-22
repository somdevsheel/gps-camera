import React, {memo} from 'react';
import {Pressable, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import {Colors, HIT_TARGET, Radius, Spacing} from '../constants';
import {Icon} from './Icon';

interface BaseProps {
  label: string;
  description?: string;
}

export const SettingSwitch = memo(function SettingSwitchImpl({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: BaseProps & {value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean}) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? Colors.accent : Colors.textFaint}
        trackColor={{false: Colors.border, true: Colors.accentDim}}
      />
    </View>
  );
});

interface OptionProps<T extends string> extends BaseProps {
  value: T;
  options: ReadonlyArray<{value: T; label: string}>;
  onChange: (value: T) => void;
}

/** Horizontal segmented selector; wraps on narrow screens. */
function SettingOptionsInner<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: OptionProps<T>) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.options}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{selected}}
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => onChange(option.value)}
              style={({pressed}) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const SettingOptions = memo(SettingOptionsInner) as typeof SettingOptionsInner;

export const SettingText = memo(function SettingTextImpl({
  label,
  description,
  value,
  placeholder,
  onChangeText,
  maxLength = 64,
}: BaseProps & {
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaint}
        onChangeText={onChangeText}
        maxLength={maxLength}
        style={styles.input}
      />
    </View>
  );
});

export const SettingLink = memo(function SettingLinkImpl({
  label,
  description,
  onPress,
  danger = false,
}: BaseProps & {onPress: () => void; danger?: boolean}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.textWrap}>
        <Text style={[styles.label, danger && styles.danger]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Icon name="chevron" size={20} color={Colors.textFaint} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  block: {paddingVertical: Spacing.sm, gap: Spacing.xs},
  textWrap: {flex: 1},
  label: {color: Colors.text, fontSize: 15, fontWeight: '600'},
  danger: {color: Colors.danger},
  description: {color: Colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16},
  options: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs},
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {backgroundColor: Colors.accent, borderColor: Colors.accent},
  chipLabel: {color: Colors.textMuted, fontSize: 13, fontWeight: '600'},
  chipLabelSelected: {color: Colors.background},
  input: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    minHeight: HIT_TARGET,
    fontSize: 15,
  },
  pressed: {opacity: 0.7},
});

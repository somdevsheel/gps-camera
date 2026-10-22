import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Colors, Spacing} from '../constants';
import {AppButton} from './AppButton';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = memo(function EmptyStateImpl({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {color: Colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center'},
  message: {color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20},
  action: {marginTop: Spacing.lg, minWidth: 200},
});

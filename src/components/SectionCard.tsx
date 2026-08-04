import React, {memo, type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Colors, Radius, Spacing} from '../constants';

interface SectionCardProps {
  title: string;
  footnote?: string;
  children: ReactNode;
}

export const SectionCard = memo(function SectionCard({
  title,
  footnote,
  children,
}: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {children}
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: Spacing.sm,
  },
  footnote: {color: Colors.textFaint, fontSize: 11, marginTop: Spacing.md, lineHeight: 15},
});

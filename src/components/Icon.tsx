import React, {memo} from 'react';
import {StyleSheet, Text, type TextStyle} from 'react-native';
import {Colors} from '../constants';

/**
 * Glyph icons drawn from the system font. This keeps the bundle free of an
 * icon library (and its font assets) for the handful of symbols we need.
 */
export const GLYPHS = {
  // '\uFE0E' forces text presentation. Without it Android draws ⚡ ⚙ ☀ as colour
  // emoji, which ignore the `color` prop and look the same in every state.
  flashOff: '⊘',
  flashOn: '⚡\uFE0E',
  flip: '⇄',
  gallery: '▣',
  settings: '⚙\uFE0E',
  torch: '☀\uFE0E',
  close: '✕',
  check: '✓',
  share: '↗',
  trash: '✕',
  map: '◎',
  copy: '⧉',
  back: '‹',
  chevron: '›',
  warning: '!',
  location: '◉',
  shield: '⛨',
  camera: '◐',
  zoom: '＋',
} as const;

export type GlyphName = keyof typeof GLYPHS;

interface IconProps {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export const Icon = memo(function IconImpl({
  name,
  size = 20,
  color = Colors.text,
  style,
}: IconProps) {
  return (
    <Text
      allowFontScaling={false}
      style={[styles.glyph, {fontSize: size, color, lineHeight: size * 1.2}, style]}>
      {GLYPHS[name]}
    </Text>
  );
});

const styles = StyleSheet.create({
  glyph: {
    textAlign: 'center',
  },
});

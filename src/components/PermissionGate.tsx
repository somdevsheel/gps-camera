import React, {memo} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {PermissionSnapshot} from '../types';
import {APP_NAME, Colors, Spacing} from '../constants';
import {AppButton} from './AppButton';

const logo = require('../assets/logo.png');

interface PermissionGateProps {
  snapshot: PermissionSnapshot;
  busy: boolean;
  onRequest: () => void;
  onOpenSettings: () => void;
}

/**
 * Shown when the camera permission is missing. The rationale is stated before
 * the system dialog appears, and a blocked permission routes to app settings
 * instead of re-prompting into a dead end.
 */
export const PermissionGate = memo(function PermissionGateImpl({
  snapshot,
  busy,
  onRequest,
  onOpenSettings,
}: PermissionGateProps) {
  const blocked = snapshot.camera === 'blocked';

  return (
    // Scrollable so the action button stays reachable on small screens and with
    // large system font sizes.
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.body}>
        This app needs two permissions to do its job:
      </Text>
      <View style={styles.list}>
        <Text style={styles.item}>
          <Text style={styles.itemTitle}>Camera </Text>— to take the photo.
        </Text>
        <Text style={styles.item}>
          <Text style={styles.itemTitle}>Precise location </Text>— to read the GPS coordinates
          that get stamped onto it. Approximate location is not accurate enough for a field
          record.
        </Text>
      </View>
      <Text style={styles.privacy}>
        Photos and location data stay on this device. Nothing is uploaded.
      </Text>
      {blocked ? (
        <AppButton title="Open app settings" onPress={onOpenSettings} style={styles.action} />
      ) : (
        <AppButton
          title="Grant permissions"
          onPress={onRequest}
          busy={busy}
          style={styles.action}
        />
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: Colors.background},
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  body: {color: Colors.textMuted, fontSize: 15, lineHeight: 21},
  list: {marginTop: Spacing.md, gap: Spacing.sm},
  item: {color: Colors.textMuted, fontSize: 14, lineHeight: 20},
  itemTitle: {color: Colors.text, fontWeight: '700'},
  privacy: {color: Colors.textFaint, fontSize: 12, marginTop: Spacing.lg, lineHeight: 17},
  action: {marginTop: Spacing.xl},
});

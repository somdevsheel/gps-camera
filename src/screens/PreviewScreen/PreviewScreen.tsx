import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Colors, Radius, Spacing} from '../../constants';
import type {RootStackParamList} from '../../navigation/types';
import {useCaptureStore} from '../../store/captureStore';
import {useSettingsStore} from '../../store/settingsStore';
import {mediaService} from '../../services/media/MediaService';
import {formatCoordinatePair, formatDateTime} from '../../utils/format';
import {AppButton} from '../../components/AppButton';
import {Banner} from '../../components/Banner';
import {EmptyState} from '../../components/EmptyState';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Preview'>;
type PreviewRoute = RouteProp<RootStackParamList, 'Preview'>;

export function PreviewScreen(): React.ReactElement {
  const navigation = useNavigation<Navigation>();
  const {params} = useRoute<PreviewRoute>();
  const settings = useSettingsStore(state => state.settings);
  const records = useCaptureStore(state => state.records);
  const removeRecord = useCaptureStore(state => state.removeRecord);
  const [working, setWorking] = useState(false);

  const record = useMemo(
    () => records.find(item => item.captureId === params.captureId) ?? null,
    [records, params.captureId],
  );

  const imagePath = record?.stampedImagePath ?? record?.originalImagePath ?? null;

  const handleShare = useCallback(async () => {
    if (!imagePath || !record) {
      return;
    }
    setWorking(true);
    const caption =
      record.latitude !== null && record.longitude !== null
        ? `${record.address ?? 'Capture'} — ${formatCoordinatePair(
            record.latitude,
            record.longitude,
            settings.coordinateFormat,
          )}`
        : 'Capture';
    const result = await mediaService.share(imagePath, caption);
    setWorking(false);
    if (!result.ok) {
      Alert.alert('Share failed', result.message);
    }
  }, [imagePath, record, settings.coordinateFormat]);

  const handleDelete = useCallback(() => {
    if (!record) {
      return;
    }
    Alert.alert('Delete photo', 'This removes the photo and its capture record from the app.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          const deleted = await removeRecord(record);
          setWorking(false);
          if (deleted) {
            navigation.navigate('Camera');
          } else {
            Alert.alert('Delete failed', 'The photo could not be deleted.');
          }
        },
      },
    ]);
  }, [record, removeRecord, navigation]);

  const handleOpenInMaps = useCallback(async () => {
    if (!record?.latitude || !record?.longitude) {
      return;
    }
    const result = await mediaService.openInMaps(
      record.latitude,
      record.longitude,
      record.address ?? 'Capture location',
    );
    if (!result.ok) {
      Alert.alert('No maps app', 'No application is installed that can open these coordinates.');
    }
  }, [record]);

  if (!record || !imagePath) {
    return (
      <EmptyState
        title="Capture not found"
        message="This capture is no longer available."
        actionLabel="Back to camera"
        onAction={() => navigation.navigate('Camera')}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Image
        source={{uri: `file://${imagePath}`}}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="Captured photo with location stamp"
      />

      {params.warnings.map(warning => (
        <Banner key={warning} tone="warning" title="Heads up" message={warning} />
      ))}

      <View style={styles.meta}>
        <Text style={styles.metaPrimary}>{record.address ?? 'Address unavailable'}</Text>
        {record.latitude !== null && record.longitude !== null ? (
          <Text style={styles.metaSecondary}>
            {formatCoordinatePair(record.latitude, record.longitude, settings.coordinateFormat)}
          </Text>
        ) : (
          <Text style={styles.metaSecondary}>No coordinates recorded</Text>
        )}
        <Text style={styles.metaSecondary}>
          {formatDateTime(record.captureTimestamp, settings.dateFormat, settings.timeFormat)}
        </Text>
        {record.verificationStatus === 'gps-verified' ? (
          <Text style={styles.verified}>GPS-verified capture · SHA-256 recorded</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <AppButton title="Share" onPress={handleShare} busy={working} style={styles.action} />
        <AppButton
          title="Details"
          variant="secondary"
          onPress={() => navigation.navigate('PhotoDetails', {captureId: record.captureId})}
          style={styles.action}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          title="Open in maps"
          variant="ghost"
          onPress={handleOpenInMaps}
          disabled={record.latitude === null}
          style={styles.action}
        />
        <AppButton
          title="Delete"
          variant="danger"
          onPress={handleDelete}
          busy={working}
          style={styles.action}
        />
      </View>
      <AppButton
        title="Back to camera"
        variant="ghost"
        onPress={() => navigation.navigate('Camera')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl},
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  meta: {gap: 2},
  metaPrimary: {color: Colors.text, fontSize: 16, fontWeight: '700'},
  metaSecondary: {color: Colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums']},
  verified: {color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  actions: {flexDirection: 'row', gap: Spacing.md},
  action: {flex: 1},
});

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {CaptureRecord, VerificationStatus} from '../../types';
import {Colors, Radius, Spacing} from '../../constants';
import type {RootStackParamList} from '../../navigation/types';
import {useCaptureStore} from '../../store/captureStore';
import {useSettingsStore} from '../../store/settingsStore';
import {captureService} from '../../services/camera/CaptureService';
import {mediaService} from '../../services/media/MediaService';
import {
  formatAccuracy,
  formatAltitude,
  formatCoordinatePair,
  formatDateTime,
  formatHeading,
  formatSpeed,
} from '../../utils/format';
import {AppButton} from '../../components/AppButton';
import {EmptyState} from '../../components/EmptyState';
import {SectionCard} from '../../components/SectionCard';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'PhotoDetails'>;
type DetailsRoute = RouteProp<RootStackParamList, 'PhotoDetails'>;

const STATUS_LABEL: Record<VerificationStatus, string> = {
  'gps-verified': 'GPS-verified',
  unverified: 'Not verified',
  tampered: 'Hash mismatch — file changed since capture',
  'not-applicable': 'Verified capture mode was off',
};

function Row({label, value}: {label: string; value: string}): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function PhotoDetailsScreen(): React.ReactElement {
  const navigation = useNavigation<Navigation>();
  const {params} = useRoute<DetailsRoute>();
  const settings = useSettingsStore(state => state.settings);
  const records = useCaptureStore(state => state.records);
  const removeRecord = useCaptureStore(state => state.removeRecord);
  const updateRecord = useCaptureStore(state => state.updateRecord);

  const [checking, setChecking] = useState(false);
  const [fileMissing, setFileMissing] = useState(false);

  const record = useMemo<CaptureRecord | null>(
    () => records.find(item => item.captureId === params.captureId) ?? null,
    [records, params.captureId],
  );

  const imagePath = record?.stampedImagePath ?? record?.originalImagePath ?? null;

  useEffect(() => {
    let cancelled = false;
    void mediaService.fileExists(imagePath).then(exists => {
      if (!cancelled) {
        setFileMissing(!exists);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  const handleCopyCoordinates = useCallback(async () => {
    if (!record?.latitude || !record?.longitude) {
      return;
    }
    const text = `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`;
    const result = await mediaService.copyToClipboard(text);
    Alert.alert(
      result.ok ? 'Copied' : 'Copy failed',
      result.ok ? text : 'Coordinates could not be copied.',
    );
  }, [record]);

  const handleVerify = useCallback(async () => {
    if (!record) {
      return;
    }
    setChecking(true);
    const result = await captureService.reverify(record);
    setChecking(false);
    if (!result.ok) {
      Alert.alert('Verification failed', result.message);
      return;
    }
    updateRecord({...record, verificationStatus: result.value});
    Alert.alert('Integrity check', STATUS_LABEL[result.value]);
  }, [record, updateRecord]);

  const handleDelete = useCallback(() => {
    if (!record) {
      return;
    }
    Alert.alert('Delete capture', 'The photo and its record will be removed from the app.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const deleted = await removeRecord(record);
          if (deleted) {
            navigation.goBack();
          }
        },
      },
    ]);
  }, [record, removeRecord, navigation]);

  if (!record) {
    return (
      <EmptyState
        title="Capture not found"
        message="This record no longer exists."
        actionLabel="Back"
        onAction={() => navigation.goBack()}
      />
    );
  }

  const hasCoordinates = record.latitude !== null && record.longitude !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {imagePath && !fileMissing ? (
        <Image
          source={{uri: `file://${imagePath}`}}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Captured photo"
        />
      ) : (
        <View style={[styles.image, styles.imageMissing]}>
          <Text style={styles.missingText}>Image file is missing from device storage</Text>
        </View>
      )}

      <SectionCard title="Location">
        <Row label="Address" value={record.address ?? 'Unavailable'} />
        <Row
          label="Coordinates"
          value={
            hasCoordinates
              ? formatCoordinatePair(
                  record.latitude as number,
                  record.longitude as number,
                  settings.coordinateFormat,
                )
              : 'Not recorded'
          }
        />
        <Row label="Accuracy" value={formatAccuracy(record.accuracy)} />
        <Row label="Altitude" value={formatAltitude(record.altitude)} />
        <Row label="Speed" value={formatSpeed(record.speed)} />
        <Row label="Direction" value={formatHeading(record.heading, record.cardinal)} />
        <Row label="Provider" value={record.provider ?? 'Unknown'} />
      </SectionCard>

      <SectionCard title="Time">
        <Row
          label="Captured"
          value={formatDateTime(
            record.captureTimestamp,
            settings.dateFormat,
            settings.timeFormat,
          )}
        />
        <Row
          label="GPS clock"
          value={
            record.gpsTimestamp
              ? formatDateTime(record.gpsTimestamp, settings.dateFormat, settings.timeFormat)
              : 'Not recorded'
          }
        />
      </SectionCard>

      <SectionCard
        title="Integrity"
        footnote="Hashes are computed on this device and never leave it. A mismatch means the file changed after capture.">
        <Row label="Status" value={STATUS_LABEL[record.verificationStatus]} />
        <Row label="Original SHA-256" value={record.originalSha256 ?? 'Not recorded'} />
        <Row label="Stamped SHA-256" value={record.stampedSha256 ?? 'Not recorded'} />
        <Row label="Capture ID" value={record.captureId} />
        <AppButton
          title="Re-check integrity"
          variant="secondary"
          onPress={handleVerify}
          busy={checking}
          disabled={record.verificationStatus === 'not-applicable'}
          style={styles.cardAction}
        />
      </SectionCard>

      {record.companyName || record.projectName || record.note ? (
        <SectionCard title="Field data">
          {record.companyName ? <Row label="Company" value={record.companyName} /> : null}
          {record.projectName ? <Row label="Project" value={record.projectName} /> : null}
          {record.note ? <Row label="Note" value={record.note} /> : null}
        </SectionCard>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          title="Copy coordinates"
          variant="secondary"
          onPress={handleCopyCoordinates}
          disabled={!hasCoordinates}
          style={styles.action}
        />
        <AppButton
          title="Open in maps"
          variant="secondary"
          onPress={() =>
            hasCoordinates &&
            mediaService.openInMaps(
              record.latitude as number,
              record.longitude as number,
              record.address ?? 'Capture location',
            )
          }
          disabled={!hasCoordinates}
          style={styles.action}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          title="Share"
          onPress={() => imagePath && mediaService.share(imagePath, record.address ?? 'Capture')}
          disabled={!imagePath || fileMissing}
          style={styles.action}
        />
        <AppButton title="Delete" variant="danger" onPress={handleDelete} style={styles.action} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
  },
  imageMissing: {alignItems: 'center', justifyContent: 'center', padding: Spacing.lg},
  missingText: {color: Colors.textFaint, textAlign: 'center'},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  rowLabel: {color: Colors.textMuted, fontSize: 13, flexShrink: 0},
  rowValue: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  cardAction: {marginTop: Spacing.md},
  actions: {flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md},
  action: {flex: 1},
});

import React, {useCallback, useEffect, useMemo} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {CaptureRecord} from '../../types';
import {Colors, Radius, Spacing} from '../../constants';
import type {RootStackParamList} from '../../navigation/types';
import {useCaptureStore} from '../../store/captureStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useGallerySections} from '../../hooks/useGallerySections';
import {formatTime} from '../../utils/format';
import {EmptyState} from '../../components/EmptyState';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Gallery'>;

const COLUMN_GAP = Spacing.sm;
const COLUMNS = 3;

interface ThumbProps {
  record: CaptureRecord;
  size: number;
  timeLabel: string;
  onPress: (record: CaptureRecord) => void;
}

const Thumb = React.memo(function ThumbImpl({record, size, timeLabel, onPress}: ThumbProps) {
  const path = record.stampedImagePath ?? record.originalImagePath;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Capture at ${timeLabel}`}
      onPress={() => onPress(record)}
      style={({pressed}) => [{width: size, height: size}, pressed && styles.pressed]}>
      {path ? (
        <Image source={{uri: `file://${path}`}} style={styles.thumbImage} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbImage, styles.thumbMissing]}>
          <Text style={styles.thumbMissingText}>Missing</Text>
        </View>
      )}
      <View style={styles.thumbOverlay}>
        <Text style={styles.thumbTime}>{timeLabel}</Text>
        {record.verificationStatus === 'gps-verified' ? (
          <Text style={styles.thumbVerified}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
});

/** Rows of three, built per section so SectionList stays virtualised. */
function chunk(records: CaptureRecord[]): CaptureRecord[][] {
  const rows: CaptureRecord[][] = [];
  for (let index = 0; index < records.length; index += COLUMNS) {
    rows.push(records.slice(index, index + COLUMNS));
  }
  return rows;
}

export function GalleryScreen(): React.ReactElement {
  const navigation = useNavigation<Navigation>();
  const {width} = useWindowDimensions();
  const settings = useSettingsStore(state => state.settings);
  const records = useCaptureStore(state => state.records);
  const loading = useCaptureStore(state => state.loading);
  const refresh = useCaptureStore(state => state.refresh);

  const sections = useGallerySections(records, settings.dateFormat);

  const thumbSize = useMemo(
    () => (width - Spacing.lg * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS,
    [width],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    navigation.setOptions({title: `Gallery (${records.length})`});
  }, [navigation, records.length]);

  const openDetails = useCallback(
    (record: CaptureRecord) => {
      navigation.navigate('PhotoDetails', {captureId: record.captureId});
    },
    [navigation],
  );

  const rowSections = useMemo(
    () => sections.map(section => ({...section, data: chunk(section.data)})),
    [sections],
  );

  if (loading && records.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title="No captures yet"
        message="Photos you take will appear here, grouped by the day they were captured."
        actionLabel="Open camera"
        onAction={() => navigation.navigate('Camera')}
      />
    );
  }

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      sections={rowSections}
      keyExtractor={row => row.map(item => item.captureId).join('-')}
      renderSectionHeader={({section}) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({item: row}) => (
        <View style={styles.row}>
          {row.map(record => (
            <Thumb
              key={record.captureId}
              record={record}
              size={thumbSize}
              timeLabel={formatTime(record.captureTimestamp, settings.timeFormat)}
              onPress={openDetails}
            />
          ))}
        </View>
      )}
      stickySectionHeadersEnabled={false}
      initialNumToRender={6}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  row: {flexDirection: 'row', gap: COLUMN_GAP, marginBottom: COLUMN_GAP},
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  thumbMissing: {alignItems: 'center', justifyContent: 'center'},
  thumbMissingText: {color: Colors.textFaint, fontSize: 11},
  thumbOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    backgroundColor: Colors.overlay,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  thumbTime: {color: Colors.text, fontSize: 10, fontVariant: ['tabular-nums']},
  thumbVerified: {color: Colors.accent, fontSize: 11, fontWeight: '800'},
  pressed: {opacity: 0.7},
});

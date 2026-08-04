import {useMemo} from 'react';
import type {CaptureRecord, DateFormat, GallerySection} from '../types';
import {dayKey, friendlyDayLabel} from '../utils/format';

/** Groups captures into day buckets for the sectioned gallery list. */
export function useGallerySections(
  records: CaptureRecord[],
  dateFormat: DateFormat,
): GallerySection[] {
  return useMemo(() => {
    const buckets = new Map<string, CaptureRecord[]>();
    for (const record of records) {
      const key = dayKey(record.captureTimestamp);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(record);
      } else {
        buckets.set(key, [record]);
      }
    }
    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, data]) => ({
        dayKey: key,
        title: friendlyDayLabel(data[0]?.captureTimestamp ?? Date.now(), dateFormat),
        data,
      }));
  }, [records, dateFormat]);
}

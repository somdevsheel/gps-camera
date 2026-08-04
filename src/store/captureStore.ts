import {create} from 'zustand';
import type {CaptureRecord} from '../types';
import {captureRepository} from '../database/CaptureRepository';
import {captureService} from '../services/camera/CaptureService';

interface CaptureStoreState {
  records: CaptureRecord[];
  loading: boolean;
  error: string | null;
  lastCapture: CaptureRecord | null;
  refresh: () => Promise<void>;
  addRecord: (record: CaptureRecord) => void;
  removeRecord: (record: CaptureRecord) => Promise<boolean>;
  updateRecord: (record: CaptureRecord) => void;
}

export const useCaptureStore = create<CaptureStoreState>(set => ({
  records: [],
  loading: false,
  error: null,
  lastCapture: null,

  refresh: async () => {
    set({loading: true, error: null});
    const result = await captureRepository.listRecent();
    if (result.ok) {
      set({records: result.value, loading: false});
    } else {
      set({loading: false, error: result.message});
    }
  },

  addRecord: record =>
    set(state => ({
      records: [record, ...state.records.filter(item => item.captureId !== record.captureId)],
      lastCapture: record,
    })),

  updateRecord: record =>
    set(state => ({
      records: state.records.map(item =>
        item.captureId === record.captureId ? record : item,
      ),
      lastCapture:
        state.lastCapture?.captureId === record.captureId ? record : state.lastCapture,
    })),

  removeRecord: async record => {
    const result = await captureService.deleteCapture(record);
    if (result.ok) {
      set(state => ({
        records: state.records.filter(item => item.captureId !== record.captureId),
        lastCapture:
          state.lastCapture?.captureId === record.captureId ? null : state.lastCapture,
      }));
      return true;
    }
    set({error: result.message});
    return false;
  },
}));

export const getLatestRecord = (): CaptureRecord | null =>
  useCaptureStore.getState().records[0] ?? null;

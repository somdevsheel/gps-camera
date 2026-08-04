import type {CaptureRecord} from '../types';

export type RootStackParamList = {
  Camera: undefined;
  Preview: {captureId: string; warnings: string[]};
  Gallery: undefined;
  PhotoDetails: {captureId: string};
  Settings: undefined;
};

export type CaptureParam = Pick<CaptureRecord, 'captureId'>;

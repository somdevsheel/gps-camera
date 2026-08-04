import type {ServiceResult} from '../types';
import {log} from './logger';

export function ok<T>(value: T): ServiceResult<T> {
  return {ok: true, value};
}

export function fail<T>(code: string, message: string): ServiceResult<T> {
  return {ok: false, code, message};
}

/** Normalises anything thrown across the native boundary into a ServiceResult. */
export function fromError<T>(scope: string, error: unknown, fallbackCode: string): ServiceResult<T> {
  const err = error as {code?: string; message?: string} | undefined;
  const code = typeof err?.code === 'string' ? err.code : fallbackCode;
  const message = typeof err?.message === 'string' ? err.message : String(error);
  log.warn(scope, code, message);
  return {ok: false, code, message};
}

/** Runs a promise with a hard timeout so a hung native call can never block capture. */
export function withTimeout<T>(promise: Promise<T>, ms: number, code = 'TIMEOUT'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`Operation timed out after ${ms}ms`) as Error & {code: string};
      error.code = code;
      reject(error);
    }, ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

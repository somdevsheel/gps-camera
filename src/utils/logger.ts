const PREFIX = '[GPSCam]';

/** Thin logger so we can silence or redirect diagnostics in one place. */
export const log = {
  debug(scope: string, ...args: unknown[]): void {
    if (__DEV__) {
      console.log(`${PREFIX}[${scope}]`, ...args);
    }
  },
  warn(scope: string, ...args: unknown[]): void {
    console.warn(`${PREFIX}[${scope}]`, ...args);
  },
  error(scope: string, ...args: unknown[]): void {
    console.error(`${PREFIX}[${scope}]`, ...args);
  },
};

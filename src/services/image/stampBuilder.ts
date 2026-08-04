import type {
  AppSettings,
  CompassReading,
  GpsFix,
  PostalAddress,
  StampLine,
  StampStyle,
} from '../../types';
import {APP_NAME} from '../../constants';
import {
  formatAccuracy,
  formatAltitude,
  formatHeadlineAddress,
  formatLatLongLine,
  formatSpeed,
  formatStampDateTime,
} from '../../utils/format';

export interface StampContext {
  fix: GpsFix | null;
  addressLine: string | null;
  /** Structured components, used to build the bold headline above the address. */
  address: PostalAddress | null;
  compass: CompassReading | null;
  timestamp: number;
  settings: AppSettings;
  /** True only when the fix was acquired from the OS at capture time. */
  verified: boolean;
}

function push(lines: StampLine[], line: StampLine | null): void {
  if (line) {
    lines.push(line);
  }
}

/**
 * Builds the exact text that gets burned into the photo, as a headline card:
 * a bold place name up top, the full address underneath, then a single
 * coordinate line and a single date/time/timezone line - the layout used by
 * this genre of GPS field-camera app.
 *
 * The wording is deliberately explicit about what is and is not known: if there
 * is no fix we print "Location unavailable" rather than omitting the section,
 * so a stamped photo can never imply a position it does not have.
 */
export function buildStamp(context: StampContext): {title: string; lines: StampLine[]} {
  const {fix, addressLine, address, compass, timestamp, settings, verified} = context;
  const style: StampStyle = settings.stampStyle;
  const lines: StampLine[] = [];

  const showAddress = settings.showAddress && style !== 'minimal';
  const detailed = style === 'detailed';

  // Headline: the short, glanceable place name. Falls back to the full
  // address, then to the coordinates themselves, so the card always opens
  // with *something* readable even when reverse geocoding came back empty.
  if (showAddress) {
    const headline = formatHeadlineAddress(address) ?? addressLine;
    push(lines, {
      label: null,
      value: headline ?? (fix ? 'Location' : 'Location unavailable'),
      emphasis: 'title',
    });
    if (addressLine && addressLine !== headline) {
      push(lines, {label: null, value: addressLine, emphasis: 'normal'});
    } else if (!headline && fix) {
      // Geocoding genuinely came back empty - say so explicitly rather than
      // silently dropping the address section under the headline.
      push(lines, {label: null, value: 'Address unavailable', emphasis: 'muted'});
    }
  } else if (fix) {
    push(lines, {label: null, value: formatLatLongLine(fix.latitude, fix.longitude, settings.coordinateFormat), emphasis: 'title'});
  }

  if (fix) {
    // Coordinates get their own line unless they were already used as the
    // headline above (address disabled).
    if (showAddress) {
      push(lines, {
        label: null,
        value: formatLatLongLine(fix.latitude, fix.longitude, settings.coordinateFormat),
        emphasis: 'normal',
      });
    }
    if (settings.showAccuracy) {
      push(lines, {
        label: 'Accuracy',
        value: formatAccuracy(fix.accuracy),
        emphasis: 'muted',
      });
    }
    if (settings.showAltitude && fix.altitude !== null) {
      push(lines, {
        label: 'Altitude',
        value: formatAltitude(fix.altitude),
        emphasis: 'muted',
      });
    }
    if (settings.showSpeed && fix.speed !== null) {
      push(lines, {label: 'Speed', value: formatSpeed(fix.speed), emphasis: 'muted'});
    }
    if (fix.isCoarse) {
      push(lines, {
        label: null,
        value: 'Approximate location permission — coordinates are low precision',
        emphasis: 'muted',
      });
    }
  } else if (!showAddress) {
    push(lines, {label: null, value: 'Location unavailable', emphasis: 'title'});
  }

  push(lines, {
    label: null,
    value: formatStampDateTime(timestamp, settings.dateFormat, settings.timeFormat),
    emphasis: 'normal',
  });

  if (settings.showCompass && compass && style !== 'minimal') {
    push(lines, {
      label: 'Direction',
      value: `${compass.cardinal} ${Math.round(compass.heading)}°`,
      emphasis: 'muted',
    });
  }

  if (style !== 'minimal') {
    if (settings.companyName.trim()) {
      push(lines, {
        label: 'Company',
        value: settings.companyName.trim(),
        emphasis: 'muted',
      });
    }
    if (settings.projectName.trim()) {
      push(lines, {
        label: 'Project',
        value: settings.projectName.trim(),
        emphasis: 'muted',
      });
    }
    if (settings.customNote.trim()) {
      push(lines, {label: 'Note', value: settings.customNote.trim(), emphasis: 'muted'});
    }
  }

  if (detailed && fix) {
    push(lines, {
      label: 'Source',
      value: `${fix.provider.toUpperCase()} provider`,
      emphasis: 'muted',
    });
  }

  if (verified) {
    push(lines, {label: null, value: 'GPS VERIFIED CAPTURE', emphasis: 'strong'});
  }

  // `title` is no longer drawn as a panel row - it's the small app-branding
  // watermark chip in the corner of the photo (see StampRenderer.kt).
  return {title: APP_NAME.toUpperCase(), lines};
}

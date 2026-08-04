import NativeGpsImage from '../../specs/NativeGpsImage';
import {MAP} from '../../constants';
import type {ServiceResult} from '../../types';
import {fail, fromError, ok} from '../../utils/result';

/**
 * Static map thumbnails for the optional map stamp.
 *
 * This is the only component that talks to a network service. It is isolated
 * behind `StaticMapProvider` so it can be replaced (or removed entirely for a
 * fully offline build) without touching the capture pipeline. Failure is always
 * non-fatal: the stamp falls back to text-only.
 */
export interface StaticMapProvider {
  readonly name: string;
  render(latitude: number, longitude: number, sizePx: number): Promise<ServiceResult<string>>;
}

class RasterTileMapProvider implements StaticMapProvider {
  readonly name = 'osm-raster-tiles';

  async render(
    latitude: number,
    longitude: number,
    sizePx: number,
  ): Promise<ServiceResult<string>> {
    try {
      const raw = (await NativeGpsImage.renderStaticMap({
        latitude,
        longitude,
        zoom: MAP.TILE_ZOOM,
        sizePx,
        timeoutMs: MAP.TIMEOUT_MS,
      })) as {ok?: boolean; path?: string};
      if (raw?.ok === true && typeof raw.path === 'string') {
        return ok(raw.path);
      }
      return fail('MAP_UNAVAILABLE', 'Map tiles could not be fetched.');
    } catch (error) {
      return fromError('MapService.render', error, 'MAP_UNAVAILABLE');
    }
  }
}

export const mapService: StaticMapProvider = new RasterTileMapProvider();

import {useCallback, useEffect, useState} from 'react';
import type {PermissionSnapshot} from '../types';
import {permissionService} from '../services/permissions/PermissionService';
import {useGpsStore} from '../store/gpsStore';

interface UsePermissionsResult {
  snapshot: PermissionSnapshot | null;
  checking: boolean;
  requestAll: () => Promise<PermissionSnapshot>;
  refresh: () => Promise<PermissionSnapshot>;
  openSettings: () => void;
}

/**
 * Camera and location are requested separately and in that order: the camera
 * rationale is shown first because without it there is no app at all, and a
 * user who declines location can still take (unstamped) photos.
 */
export function usePermissions(): UsePermissionsResult {
  const setPermissions = useGpsStore(state => state.setPermissions);
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    const next = await permissionService.snapshot();
    setSnapshot(next);
    setPermissions(next);
    setChecking(false);
    return next;
  }, [setPermissions]);

  const requestAll = useCallback(async () => {
    setChecking(true);
    await permissionService.requestCamera();
    const next = await permissionService.requestLocation();
    setSnapshot(next);
    setPermissions(next);
    setChecking(false);
    return next;
  }, [setPermissions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    checking,
    requestAll,
    refresh,
    openSettings: permissionService.openAppSettings,
  };
}

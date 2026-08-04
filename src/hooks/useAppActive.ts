import {useEffect, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';

/**
 * True only when the app is in the foreground. Screens use this together with
 * navigation focus to release the camera, GPS and sensors the moment they are
 * not needed.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      setActive(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  return active;
}

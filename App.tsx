import React, {useEffect} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Colors} from './src/constants';
import {RootNavigator} from './src/navigation/RootNavigator';
import {useCaptureStore} from './src/store/captureStore';
import {getDatabase} from './src/database/db';
import {log} from './src/utils/logger';

function App(): React.ReactElement {
  const refresh = useCaptureStore(state => state.refresh);

  useEffect(() => {
    // Warm the database and load existing captures before the gallery is opened.
    getDatabase()
      .then(() => refresh())
      .catch(error => log.error('App', 'database bootstrap failed', error));
  }, [refresh]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <RootNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},
});

export default App;

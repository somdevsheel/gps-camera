import React from 'react';
import {NavigationContainer, type Theme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Colors} from '../constants';
import {CameraScreen} from '../screens/CameraScreen/CameraScreen';
import {PreviewScreen} from '../screens/PreviewScreen/PreviewScreen';
import {GalleryScreen} from '../screens/GalleryScreen/GalleryScreen';
import {PhotoDetailsScreen} from '../screens/PhotoDetailsScreen/PhotoDetailsScreen';
import {SettingsScreen} from '../screens/SettingsScreen/SettingsScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.accent,
  },
  fonts: {
    regular: {fontFamily: 'System', fontWeight: '400'},
    medium: {fontFamily: 'System', fontWeight: '500'},
    bold: {fontFamily: 'System', fontWeight: '700'},
    heavy: {fontFamily: 'System', fontWeight: '900'},
  },
};

export function RootNavigator(): React.ReactElement {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Camera"
        screenOptions={{
          headerStyle: {backgroundColor: Colors.surface},
          headerTintColor: Colors.text,
          headerTitleStyle: {fontWeight: '700'},
          contentStyle: {backgroundColor: Colors.background},
          animation: 'slide_from_right',
        }}>
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{headerShown: false, animation: 'fade'}}
        />
        <Stack.Screen name="Preview" component={PreviewScreen} options={{title: 'Preview'}} />
        <Stack.Screen name="Gallery" component={GalleryScreen} options={{title: 'Gallery'}} />
        <Stack.Screen
          name="PhotoDetails"
          component={PhotoDetailsScreen}
          options={{title: 'Capture details'}}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{title: 'Settings'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Shows native app version, and Stallion OTA counter when a CodePush
 * release is currently running — e.g. "App version 1.1.1 (V7)".
 */
import React from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { formatAppVersionLabel, getAppVersion, getOtaReleaseHashShort } from '../utils/appVersion';

function stallionOtaEnabled(): boolean {
  if (Platform.OS === 'web' || __DEV__) return false;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';
  return !inExpoGo;
}

type Props = {
  style?: StyleProp<TextStyle>;
  /** Prefix before the version, e.g. "App version " or "v" */
  prefix?: string;
};

function StallionAwareVersion({ style, prefix = '' }: Props) {
  // Hook only mounts when Stallion context exists (withStallion wrap).
  const { useStallionUpdate } = require('react-native-stallion') as {
    useStallionUpdate: () => {
      currentlyRunningBundle: { version?: number; id?: string } | null;
    };
  };
  const { currentlyRunningBundle } = useStallionUpdate();
  const otaActive = Boolean(getOtaReleaseHashShort());
  const otaVersion =
    typeof currentlyRunningBundle?.version === 'number'
      ? currentlyRunningBundle.version
      : null;
  const label = formatAppVersionLabel({
    otaActive,
    otaVersion: otaActive ? otaVersion : null,
  });
  return (
    <Text style={style} selectable>
      {prefix}
      {label}
    </Text>
  );
}

export function AppVersionLabel({ style, prefix = '' }: Props) {
  if (!stallionOtaEnabled()) {
    return (
      <Text style={style} selectable>
        {prefix}
        {getAppVersion()}
      </Text>
    );
  }
  return <StallionAwareVersion style={style} prefix={prefix} />;
}

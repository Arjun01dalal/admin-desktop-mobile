import { Alert, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { appStorage } from '../lib/webShim';

const ANDROID_DIR_KEY = 'sheet_download_dir_uri';

/** Hide WhatsApp / chat apps. iOS Save to Files stays available. */
const IOS_EXCLUDE_SHARE_APPS = [
  'net.whatsapp.WhatsApp.ShareExtension',
  'net.whatsapp.WhatsAppSMB.ShareExtension',
  'org.telegram.Telegram.Share',
  'ph.telegra.Telegraph.Share',
  'com.burbn.instagram.shareextension',
  'com.tinyspeck.chatlyio.share',
  'com.apple.UIKit.activity.PostToFacebook',
  'com.apple.UIKit.activity.PostToTwitter',
  'com.apple.UIKit.activity.PostToWeibo',
  'com.apple.UIKit.activity.Message',
  'com.apple.UIKit.activity.Mail',
  'com.apple.UIKit.activity.CopyToPasteboard',
];

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function safeFileName(fileName: string): string {
  const raw = fileName.replace(/[^\w.\-]+/g, '_') || 'sheet.csv';
  return raw.toLowerCase().endsWith('.csv') ? raw : `${raw}.csv`;
}

async function saveOnAndroid(fileName: string, csv: string): Promise<boolean> {
  const saf = FileSystem.StorageAccessFramework;
  const writeToDir = async (directoryUri: string) => {
    const fileUri = await saf.createFileAsync(directoryUri, fileName, 'text/csv');
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  };

  const pickDir = async (): Promise<string | null> => {
    const perm = await saf.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    appStorage.setItem(ANDROID_DIR_KEY, perm.directoryUri);
    return perm.directoryUri;
  };

  let dir = appStorage.getItem(ANDROID_DIR_KEY) || (await pickDir());
  if (!dir) {
    Alert.alert('Save cancelled', 'Select Downloads (or any folder) to save the sheet.');
    return false;
  }

  try {
    await writeToDir(dir);
  } catch {
    appStorage.removeItem(ANDROID_DIR_KEY);
    dir = await pickDir();
    if (!dir) {
      Alert.alert('Save cancelled', 'Select Downloads (or any folder) to save the sheet.');
      return false;
    }
    await writeToDir(dir);
  }

  Alert.alert('Sheet saved', `${fileName} saved to the selected folder.`);
  return true;
}

async function saveOnIos(fileName: string, csv: string): Promise<boolean> {
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) {
    Alert.alert('Cannot save file on this device');
    return false;
  }
  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  // iOS does not create an "Astro" folder in Files. Save to Files is the picker.
  const result = await Share.share(
    { url: fileUri, title: fileName },
    { subject: fileName, excludedActivityTypes: IOS_EXCLUDE_SHARE_APPS },
  );
  return result.action !== Share.dismissedAction;
}

/** Save a CSV onto the device. Does not open WhatsApp. */
export async function shareCsvFile(
  fileName: string,
  csv: string,
): Promise<boolean> {
  const safe = safeFileName(fileName);
  try {
    if (Platform.OS === 'android') return saveOnAndroid(safe, csv);
    return saveOnIos(safe, csv);
  } catch (err) {
    Alert.alert(err instanceof Error ? err.message : 'Failed to save sheet');
    return false;
  }
}

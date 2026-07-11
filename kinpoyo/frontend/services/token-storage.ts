import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store はネイティブのキーチェーン/キーストア用で、Web版には
// 一部メソッドが実装されておらず起動時に例外になる。Webのみ localStorage にフォールバックする。
const isWeb = Platform.OS === 'web';

export async function getToken(key: string): Promise<string | null> {
  if (isWeb) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setToken(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteToken(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { webAppType } from '../constants/common.config'
import { Platform } from 'react-native'
export async function getAppType(): Promise<string> {
   return (await getItem(SK.Auth.APP_TYPE)) ?? "";
}

export function isWebApp(): boolean {
   return webAppType.includes(getAppType());
}

export function isBrowser(): boolean {
   return Platform.OS == 'web';
}
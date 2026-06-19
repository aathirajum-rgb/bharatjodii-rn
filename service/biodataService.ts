import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'

// Biodata missing-field cascade — mirrors Angular's biodata.service.ts.
// Checks profile completeness and navigates to the first missing edit screen.

interface BiodataField {
  field: string
  pageNo: number
}

// Order is the Angular priority cascade — first missing wins
const BIODATA_CASCADE: BiodataField[] = [
  { field: 'PI_PROFILEPHOTO',    pageNo: 20 },
  { field: 'PI_MONTHLYINCOME',   pageNo: 12 },
  { field: 'PI_PHYSICALSTATUS',  pageNo: 40 },
  { field: 'PI_EATINGHABITS',    pageNo: 38 },
  { field: 'PI_DRINKING',        pageNo: 36 },
  { field: 'PI_SMOKING',         pageNo: 37 },
  { field: 'PI_GOTHRAM',         pageNo: 16 },
  { field: 'PI_RAASI',           pageNo: 31 },
  { field: 'PI_DOSHAM',          pageNo: 33 },
  { field: 'PI_STAR',            pageNo: 32 },
  { field: 'PI_BROTHERS',        pageNo: 28 },
  { field: 'PI_SISTERS',         pageNo: 29 },
  { field: 'PI_PROPERTY',        pageNo: 21 },
  { field: 'PI_HOROSCOPE',       pageNo: 22 },
]

const MISSING_SENTINEL = new Set(['', '0', 'null', 'undefined', null, undefined])

function isMissing(value: any): boolean {
  return MISSING_SENTINEL.has(value)
}

export async function redirectToMissingPage(frmPage: string, fieldKey: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&TYPE=BIODATA`
  const result = await apiCall(Endpoints.profile.viewProfile, 'POST', params)

  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    const bioData = result.RESPONSE
    redirectToPage(frmPage, fieldKey, bioData)
  }
}

export function redirectToPage(frmPage: string, fieldKey: string, bioData: any): void {
  // Find the first missing field in cascade order
  const missing = BIODATA_CASCADE.find(({ field }) => isMissing(bioData?.[field]))

  if (missing) {
    goToEditScreen(missing.pageNo, frmPage)
  } else {
    // All filled — navigate to the requested field's edit screen
    const match = BIODATA_CASCADE.find(b => b.field.toLowerCase().includes(fieldKey.toLowerCase()))
    if (match) goToEditScreen(match.pageNo, frmPage)
  }
}

export function goToEditScreen(pageNo: number, frmPage = '', addFlag = false): void {
  navigate(ENavigation.EDIT_FORM, { pageNo, frm_page: frmPage, add: addFlag })
}

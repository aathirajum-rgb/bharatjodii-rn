import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { updateProfile } from './profileService'

// Angular: pages/edit-profile/edit-profile.page.ts getUserDetails() → editprofile/editmemberinfo/v1
// (ID + MCODE), and pages/registration/registration.page.ts's editProfileUpdateObj — the numeric
// TYPE codes accepted by editprofile/updatememberinfo/v1. Confirmed against a live network capture
// (TYPE=14 for STAR).
//
// IMPORTANT (confirmed against Angular source, not assumed): even for fields that have a batch
// endpoint during registration (STAR+RAASI+DOSHAM → registration/zodiacinfo/v1, BROTHERS+SISTERS+
// PROPERTIES → registration/familyinfo/v1), Angular's own edit-profile code path (`router.url.
// includes('/editform')`) bypasses those batch endpoints and saves ONE field at a time through the
// same generic editprofileupdate call used for everything else. So there is no batch-save endpoint
// to call here — "Submit" on a group screen means firing this per-field call once per changed field.

export const FIELD_TYPE_CODE = {
  NAME:           '1',
  MARITALSTATUS:  '2',
  AGE:            '3',
  HEIGHT:         '4',
  HEIGHTCATEGORY: '4',
  STATE:          '6',
  CITY:           '6',
  COUNTRY:        '6',
  QUALIFICATION:  '7',
  OCCUPATION:     '8',
  INCOME:         '9',
  RELIGION:       '10',
  CASTE:          '11',
  SUBCASTE:       '11',
  GOTHRA:         '12',
  DOSHAM:         '13',
  STAR:           '14',
  RAASI:          '15',
  BROTHERS:       '16',
  SISTERS:        '17',
  PROPERTIES:     '18',
  MOBILENO:       '19',
  // Angular's form-fields.component.ts's DOB entry path (goToNext()) fires
  // TWO calls when YEAR/MONTH/DATE are all set: TYPE=20 with the tilde-joined
  // "YEAR~MONTH~DATE" triple, THEN a separate TYPE=3 (AGE) call with the
  // client-computed age. Both must be sent — the backend's own
  // Age-completeness check (the one that re-sends page_id 47 on login) may
  // key off the DOB=20 record specifically, not just the derived AGE value.
  DOB:            '20',
  // Missing from Angular's registration.page.ts's own editProfileUpdateObj
  // copy — but the actual submit path for these two fields is the shared
  // <app-form-fields> component, which has a SEPARATE, more complete copy
  // of this same map (components/form-fields/form-fields.component.ts) that
  // does include them. Confirmed by reading that second copy directly.
  SMOKING:        '21',
  DRINKING:       '22',
  MOTHERTONGUE:   '23',
  EATING:         '24',
  NOOFCHILDREN:   '25',
  PHYSICALSTATUS: '26',
  NRICOUNTRY:     '27',
  NRISTATE:       '27',
  HOMESTATE:      '31',
  HOMECITY:       '31',
  CREATEDBY:      '30',
} as const

export type FieldKey = keyof typeof FIELD_TYPE_CODE

export interface EditProfileInfo {
  name?:           string | undefined
  // Not confirmed against a live capture — inferred raw key, same caution as
  // other fields in this file that carry a similar note.
  gender?:         string | undefined
  age?:            string | undefined
  dateOfBirth?:    string | undefined
  height?:         string | undefined
  heightCategory?: string | undefined
  maritalStatus?:  string | undefined
  noOfChildren?:   string | undefined
  physicalStatus?: string | undefined
  motherTongue?:   string | undefined
  // Raw CREATEDBY code (e.g. Angular's registrationArray.PROFILECREATEDBY key) —
  // display-only on the hub, resolved via fetchProfileCreatedByOptions(). Not
  // confirmed against a live capture.
  createdBy?:      string | undefined

  state?:      string | undefined
  city?:       string | undefined
  nriCountry?: string | undefined
  nriState?:   string | undefined
  country?:    string | undefined
  homeState?:  string | undefined
  homeCity?:   string | undefined

  education?:  string | undefined   // Angular's EDUCATION → QUALIFICATION
  // JODII-490: raw EDUDETAILS/OCCDETAILS values, saved via the dedicated
  // registration/updprofileinfo/v1 endpoint (registrationService.ts's
  // updateFewMoreDetail()) — NOT part of the FIELD_TYPE_CODE map below.
  educationGroup?: string | undefined
  occupation?: string | undefined
  jobDetail?:  string | undefined
  income?:     string | undefined   // Angular's MONTHLYINCOME → INCOME
  incomeType?: string | undefined

  religion?: string | undefined
  caste?:    string | undefined
  subCaste?: string | undefined
  gothram?:  string | undefined
  // Angular parses DOSHAM as a '~'-delimited string; if the first segment is a
  // numeric type >2, the whole thing is reinterpreted as DOSHAMTYPE and DOSHAM
  // forced to '1'. Kept as separate fields here rather than silently merged.
  dosham?:      string | undefined
  doshamType?:  string[] | undefined
  star?:        string | undefined
  raasi?:       string | undefined
  horoscopeAvailable?: boolean | undefined
  horoInfo?: {
    birthDay?:    string | undefined
    birthCity?:   string | undefined
    birthState?:  string | undefined
    birthHour?:   string | undefined
    birthMinute?: string | undefined
  } | undefined

  brothers?: string | undefined
  sisters?:  string | undefined
  // Angular explicitly filters codes '5','6','7' (vehicle types) out of
  // FAMILYPROPERTY when populating "Properties owned" — comment: "remove
  // vehicle related changes". Kept as two separate arrays to match the new
  // design's two rows (Properties owned / Own Vehicle) instead of guessing
  // which raw codes mean which — resolve labels via fetchPropertyOptions().
  properties?: string[]   // non-vehicle codes
  vehicles?:   string[]   // codes '5','6','7'

  drinkingHabits?: string | undefined
  smokingHabits?:  string | undefined
  eatingHabits?:   string | undefined

  mobileNo?:     string | undefined
  missedCallNo?: string | undefined

  // One-time-edit lock flags, derived from the API's *EDIT flags (see
  // isEditable() below — the raw flag is 1 once the field has been edited).
  // When false, tapping the field must open FieldRestrictedSheet ("contact
  // Customer Support") instead of navigating to its editor — the same seven
  // fields Angular's showDisableToast() gates.
  nameEditable:          boolean
  ageEditable:           boolean
  casteEditable:         boolean
  incomeEditable:        boolean
  motherTongueEditable:  boolean
  religionEditable:      boolean
  createdByEditable:     boolean
}

// Angular (edit-profile.page.ts getUserDetails): `if (parseInt(FLAG) == 1)
// { xEditEnable = false }` — the flag means "this field has ALREADY been
// edited once", so 1 = locked and anything else (including a missing flag)
// leaves the field editable. An earlier version of this helper had it
// backwards (`!== '0'`), which reported every already-locked field as still
// editable and let the user walk into an editor the API would then reject.
function isEditable(v: any): boolean {
  return parseInt(String(v ?? ''), 10) !== 1
}

function parseDosham(raw: any): { dosham?: string; doshamType?: string[] } {
  if (!raw) return {}
  const parts = String(raw).split('~').filter(Boolean)
  if (parts.length === 0) return {}
  const first = Number(parts[0])
  if (!isNaN(first) && first > 2) {
    return { dosham: '1', doshamType: parts }
  }
  return { dosham: parts[0] }
}

function splitProperties(raw: any): { properties: string[]; vehicles: string[] } {
  const VEHICLE_CODES = new Set(['5', '6', '7'])
  // Confirmed via live capture: FAMILYPROPERTY comes back as an array of
  // {VALUE: "<code>"} objects, not plain codes — String(item) on one of
  // these produced the literal text "[object Object]" instead of the code.
  const all: string[] = Array.isArray(raw)
    ? raw.map(item => (item && typeof item === 'object') ? String(item.VALUE ?? '') : String(item)).filter(Boolean)
    : typeof raw === 'string' ? raw.split('~').filter(Boolean) : []
  return {
    properties: all.filter(c => !VEHICLE_CODES.has(c)),
    vehicles:   all.filter(c => VEHICLE_CODES.has(c)),
  }
}

export async function fetchEditProfileInfo(): Promise<EditProfileInfo | null> {
  const [userId, mCode] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.MEMBER_CODE),
  ])
  const params = `ID=${userId ?? ''}&MCODE=${mCode ?? '91'}`
  const res = await apiCall(Endpoints.profile.editInfo, 'POST', params)

  if (res?.RESPONSECODE != 1 || res?.ERRCODE != 0 || !res?.RESPONSE) return null
  const r = res.RESPONSE

  const { dosham, doshamType } = parseDosham(r['DOSHAM'])
  const { properties, vehicles } = splitProperties(r['FAMILYPROPERTY'])

  return {
    name:           r['NAME'],
    gender:         r['GENDER'],
    createdBy:      r['CREATEDBY'],
    // AGE/HEIGHT/MARITALSTATUS: the API returns these as raw JSON numbers (not
    // strings like every other field here) — confirmed against a live capture
    // (MARITALSTATUS: 3, AGE: 27, HEIGHT: 0). Left as numbers, MARITALSTATUS
    // silently failed every labelFor() lookup against the (string-keyed)
    // options list — '3' === 3 is false — so a real update always fell back
    // to the "Add info" placeholder.
    age:            r['AGE'] != null ? String(r['AGE']) : undefined,
    dateOfBirth:    r['DATEOFBIRTH'],
    height:         r['HEIGHT'] != null ? String(r['HEIGHT']) : undefined,
    heightCategory: r['HEIGHTCATEGORY'],
    maritalStatus:  r['MARITALSTATUS'] != null ? String(r['MARITALSTATUS']) : undefined,
    noOfChildren:   r['NOOFCHILDREN'],
    physicalStatus: r['PHYSICALSTATUS'],
    motherTongue:   r['MOTHERTONGUE'],

    state:      r['STATE'],
    city:       r['CITY'],
    nriCountry: r['NRICOUNTRY'],
    nriState:   r['NRISTATE'],
    country:    r['COUNTRY'],
    homeState:  r['HOMESTATE'],
    homeCity:   r['HOMECITY'],

    education:      r['EDUCATION'],
    educationGroup: r['EDUDETAILS'],
    occupation:     r['OCCUPATION'],
    jobDetail:      r['OCCDETAILS'],
    income:     r['MONTHLYINCOME'],
    incomeType: r['INCOMETYPE'],

    religion: r['RELIGION'],
    caste:    r['CASTE'],
    subCaste: r['SUBCASTE'],
    gothram:  r['GOTHRAM'],
    dosham,
    doshamType,
    star:  r['STAR'],
    raasi: r['RAASI'],
    horoscopeAvailable: r['HOROSCOPEAVAIL'] === '1',
    horoInfo: r['HOROINFO'] ? {
      birthDay:    r['HOROINFO']['BirthDay'],
      birthCity:   r['HOROINFO']['BirthCity'],
      birthState:  r['HOROINFO']['BirthState'],
      birthHour:   r['HOROINFO']['BirthHour'],
      birthMinute: r['HOROINFO']['BirthMinute'],
    } : undefined,

    brothers: r['BROTHERS'],
    sisters:  r['SISTERS'],
    properties,
    vehicles,

    drinkingHabits: r['DRINKINGHABITS'],
    smokingHabits:  r['SMOKINGHABITS'],
    eatingHabits:   r['EATINGHABITS'],

    mobileNo:     r['MOBILENO'],
    missedCallNo: r['MISSEDCALLNO'],

    nameEditable:         isEditable(r['NAMEEDIT']),
    ageEditable:          isEditable(r['DOBEDIT']),
    casteEditable:        isEditable(r['CASTEEDIT']),
    incomeEditable:       isEditable(r['INCOMEEEDIT']),
    motherTongueEditable: isEditable(r['MOTHERTONGUEEDIT']),
    religionEditable:     isEditable(r['RELIGIONEDIT']),
    createdByEditable:    isEditable(r['CREATEDBYEDIT']),
  }
}

// ─── Batch submit for a group screen's single "Submit" button ────────────────
// Angular has no batch endpoint reachable from edit-profile (see note above) —
// this fires one editprofileupdate call per changed field, sequentially, and
// reports which fields succeeded/failed so the screen can show one summary
// message rather than silently losing partial failures.

export interface FieldChange {
  field:         FieldKey
  value:         string
  existingValue?: string | undefined
}

export interface SubmitResult {
  succeeded: FieldKey[]
  failed:    FieldKey[]
}

export async function submitFieldChanges(changes: FieldChange[]): Promise<SubmitResult> {
  const succeeded: FieldKey[] = []
  const failed: FieldKey[] = []

  for (const change of changes) {
    try {
      const res = await updateProfile(FIELD_TYPE_CODE[change.field], change.value, change.existingValue)
      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        succeeded.push(change.field)
      } else {
        failed.push(change.field)
      }
    } catch {
      failed.push(change.field)
    }
  }

  return { succeeded, failed }
}

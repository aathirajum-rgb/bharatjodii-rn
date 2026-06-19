// Shape of a single profile photo
interface IProfilePhoto {
  IMAGE: string
}

// Full profile card data returned from matches/search API
export interface IProfileInfo {
  MATRIID: string
  NAME: string
  AGE: string
  STAR: string
  HEIGHT: string
  EDUCATION: string
  OCCUPATION: string
  INCOME: string
  CITY: string
  STATE: string
  NRISTATE: string
  NRICOUNTRY: string
  MEMBERSHIP: string
  NEWUSER: string
  CASTE: string
  RELIGION: string
  PHOTOAVAILABLE: string
  PHOTOPROTECTED: string
  PHOTOCOUNT: string
  STATUS: number
  PHOTO: IProfilePhoto[]
  THUMBIMG: string
  LIKED: string
  PHONEVIEWED: string
  ADDPHOTOREQUEST: string
  VIEWPHOTOREQUEST: string
  CONTACTDATE: string
  IDVERIFIED: string
  PROFILEHIGHLIGHTER: string
  ONLINE: string
  LASTLOGIN: string
  PHONEPROTECTED: string
  PVRESITRICT: string
  PROFILEINDEX: number
  fromPage: string
}

// Minimal user info stored in AsyncStorage after login
export interface ILoggedInUser {
  userId: string       // NBID
  name: string
  gender: string
  photoUrl: string
  membershipType: string
  countryCode: string
  memberCode: string
}

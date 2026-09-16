import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import AppHeader from '../../components/app-header/AppHeader'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import ProfilePhoto from '../../components/profile-photo/ProfilePhoto'
import MatchesCard from '../../components/matches-card/MatchesCard'
import SwiperCard from '../../components/swiper-card/SwiperCard'
import BottomSheet, { type BottomSheetData, type BottomSheetType } from '../../components/bottom-sheet/BottomSheet'
import Popover, { type PopoverType } from '../../components/popover/Popover'
import ButtonComponent, { ButtonData, ButtonType } from '../../components/button/ButtonComponent'
import { Colors } from '../../constants/colors'
import FloatingLabelInput, {
  validateAge,
  validateEmail,
  validateName,
  validatePhone,
} from '../../components/input/FloatingLabelInput'
import ProfileCard from '../../components/profile-card/ProfileCard'
import Loader, { ModalLoader } from '../../components/loader/Loader'
import Badge from '../../components/badge/Badge'
import LinkCTA from '../../components/link-cta/LinkCTA'
import Chip from '../../components/chip/Chip'
import CheckboxGroup, { type CheckboxOption } from '../../components/checkbox/CheckboxGroup'
import RadioGroup, { type RadioOption } from '../../components/radio/RadioGroup'
import SelectableCard from '../../components/radio-checkbox-card/SelectableCard'
import Dropdown from '../../components/dropdown/Dropdown'
import { CDN_IMG, CDN_SVG } from '../../constants/cdn'

// ─── Styles declared first so sections array can reference them ───────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  typeBadge: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.borderBadge,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: 'monospace',
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardPreview: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  showSheetBtn: {
    backgroundColor:   Colors.primarySurface,
    borderWidth:       1,
    borderColor:       Colors.borderBadge,
    borderRadius:      8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    alignSelf:         'flex-start',
  },
  showSheetBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.primary,
  },
})

// ─── Mock data helpers ────────────────────────────────────────────────────────

const mockProfile = (liked = '0') => ({
  MATRIID: 'preview',
  LIKED: liked,
  STATUS: 0,
  PHONEVIEWED: '0',
  IDVERIFIED: '0',
})

const mockCommInfo = (liked = '0') => ({ LIKED: liked, SKIPPED: '0' })

function makeData(type: ButtonType, overrides: Partial<ButtonData> = {}): ButtonData {
  return {
    TYPE: type,
    PAGE: 'showcase',
    PROFILE: mockProfile(),
    COMMINFO: mockCommInfo(),
    SHOWLIKE: true,
    CTAWA: 'WhatsApp',
    CTACL: 'Call Now',
    ...overrides,
  }
}

function onAction(action: string, data: ButtonData) {
  Alert.alert('Button pressed', `action: ${action}\ntype: ${data?.TYPE}`)
}

// ─── Section / item data ──────────────────────────────────────────────────────

type ShowcaseItem = { label: string; description: string; node: React.ReactNode }
type Section     = { title: string; items: ShowcaseItem[] }

const sections: Section[] = [
  {
    title: 'Profile Card Icons',
    items: [
      {
        label: 'ContactVerticalBtn',
        description: 'Like · Call · WhatsApp icon row shown on match cards.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('ContactVerticalBtn', { SHOWLIKE: true, PROFILE: mockProfile('0') })}
          />
        ),
      },
      {
        label: 'ContactVerticalBtn — Liked',
        description: 'Same row after the user has liked the profile.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('ContactVerticalBtn', { SHOWLIKE: true, PROFILE: mockProfile('1') })}
          />
        ),
      },
    ],
  },
  {
    title: 'Gallery Button',
    items: [
      {
        label: 'GalleryBtn — Like (saveType 0)',
        description: 'Standard like CTA shown in gallery / view-profile.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('GalleryBtn', { COMMINFO: mockCommInfo('0') })}
          />
        ),
      },
      {
        label: 'GalleryBtn — Liked state',
        description: 'After user has liked — shows "Liked" state.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('GalleryBtn', { COMMINFO: mockCommInfo('1') })}
          />
        ),
      },
      {
        label: 'GalleryBtn — Message (saveType 2)',
        description: 'Shown when ACTIONTYPE=2 — replaces like with message CTA.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('GalleryBtn', { COMMINFO: mockCommInfo('0') })}
          />
        ),
      },
    ],
  },
  {
    title: 'View Profile Footer',
    items: [
      {
        label: 'ViewProfileFooterBtn — Not Liked',
        description: 'Skip + Call row & Message button — profile not yet liked.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('ViewProfileFooterBtn', { COMMINFO: mockCommInfo('0') })}
          />
        ),
      },
      {
        label: 'ViewProfileFooterBtn — Liked',
        description: 'Full-width Call button shown after liking.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('ViewProfileFooterBtn', { COMMINFO: mockCommInfo('1') })}
          />
        ),
      },
    ],
  },
  {
    title: 'Call & WhatsApp',
    items: [
      {
        label: 'vpCallWhatsApp',
        description: 'Side-by-side WhatsApp + Call buttons in contact details.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('vpCallWhatsApp')}
          />
        ),
      },
      {
        label: 'vpCallBtn',
        description: 'Icon-only call button in view profile body.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('vpCallBtn')} />
          </View>
        ),
      },
      {
        label: 'viewProfileCallBtn',
        description: 'Centered call icon in view profile.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('viewProfileCallBtn')} />
          </View>
        ),
      },
      {
        label: 'viewProfileCallBtnHdr',
        description: 'Small call icon in view profile header.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('viewProfileCallBtnHdr')} />
          </View>
        ),
      },
      {
        label: 'vpCallWhatsAppBtn',
        description: 'WhatsApp icon-only button.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('vpCallWhatsAppBtn')} />
          </View>
        ),
      },
    ],
  },
  {
    title: 'Message Buttons',
    items: [
      {
        label: 'vpmessageBtn',
        description: 'Centered message icon in view profile body.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('vpmessageBtn')} />
          </View>
        ),
      },
      {
        label: 'vpmessageBtnHdr',
        description: 'Small message icon in view profile header.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('vpmessageBtnHdr')} />
          </View>
        ),
      },
      {
        label: 'messageCallBtn',
        description: 'Small call icon in message list rows.',
        node: (
          <View style={styles.iconRow}>
            <ButtonComponent previewMode onAction={onAction} data={makeData('messageCallBtn')} />
          </View>
        ),
      },
    ],
  },
  {
    title: 'Menu & List Items',
    items: [
      {
        label: 'ViewProfileThreeDotBtn',
        description: 'Three-dot (⋮) dropdown — Report this Profile.',
        node: (
          <ButtonComponent previewMode onAction={onAction} data={makeData('ViewProfileThreeDotBtn')} />
        ),
      },
      {
        label: 'reportProfileBtn',
        description: 'Icon + label row for reporting a profile.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('reportProfileBtn', { BTNTEXT: 'Report profile' })}
          />
        ),
      },
      {
        label: 'phoneViewBtn',
        description: 'Icon + label row for viewing a phone number.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('phoneViewBtn', { BTNTEXT: 'View Phone' })}
          />
        ),
      },
      {
        label: 'blockProfileBtn',
        description: 'Icon + label row for blocking a profile.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('blockProfileBtn', { BTNTEXT: 'Block profile' })}
          />
        ),
      },
      {
        label: 'unblockProfileBtn',
        description: 'Icon + label row for unblocking a profile.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('unblockProfileBtn', { BTNTEXT: 'UnBlock profile' })}
          />
        ),
      },
      {
        label: 'safetyTipBtn',
        description: 'Icon + label row linking to safety tips.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            data={makeData('safetyTipBtn', { BTNTEXT: 'Safety Tips' })}
          />
        ),
      },
    ],
  },
  {
    title: 'Utility',
    items: [
      {
        label: 'NeedHelpRecharge',
        description: 'Outlined pill button shown on recharge / payment pages.',
        node: (
          <ButtonComponent
            previewMode
            onAction={onAction}
            onHelpPress={() => Alert.alert('Help', 'Opening helpline popup')}
            data={makeData('NeedHelpRecharge')}
          />
        ),
      },
    ],
  },
]

const totalItems = sections.reduce((n, s) => n + s.items.length, 0)

// ─── Interactive input showcase (needs state — separate component) ─────────────

function InputShowcase() {
  const [name,     setName]     = useState('')
  const [age,      setAge]      = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [text,     setText]     = useState('')

  // Show errors only after user has typed something
  const nameErr  = name.length  > 0 ? validateName(name)   : undefined
  const ageErr   = age.length   > 0 ? validateAge(age)     : undefined
  const emailErr = email.length > 0 ? validateEmail(email) : undefined
  const phoneErr = phone.length > 0 ? validatePhone(phone) : undefined

  const inputItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'text — Default',
      desc: 'Plain text input. Label floats above border when focused or filled.',
      node: <FloatingLabelInput label="Full Name" value={text} onChangeText={setText} />,
    },
    {
      label: 'name — Letters only, no emoji',
      desc: 'Strips emojis and special characters. Mirrors Angular alphabetOnly() filter.',
      node: (
        <FloatingLabelInput
          label="Your Name"
          value={name}
          onChangeText={setName}
          variant="name"
          errorMessage={nameErr}
        />
      ),
    },
    {
      label: 'age — Digits only (18–80)',
      desc: 'Numeric keyboard. Non-digits stripped automatically.',
      node: (
        <FloatingLabelInput
          label="Age"
          value={age}
          onChangeText={setAge}
          variant="age"
          errorMessage={ageErr}
        />
      ),
    },
    {
      label: 'email',
      desc: 'Email keyboard, lowercase auto-correct off, format validation.',
      node: (
        <FloatingLabelInput
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          variant="email"
          errorMessage={emailErr}
        />
      ),
    },
    {
      label: 'phone',
      desc: 'Phone keyboard. Non-digit characters stripped except +, space, dash.',
      node: (
        <FloatingLabelInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          variant="phone"
          errorMessage={phoneErr}
        />
      ),
    },
    {
      label: 'password — Show/Hide toggle',
      desc: 'Secure text entry with Show / Hide toggle button.',
      node: (
        <FloatingLabelInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          variant="password"
        />
      ),
    },
    {
      label: 'Error state (pre-filled)',
      desc: 'Border turns red, error message appears below when errorMessage prop is set.',
      node: (
        <FloatingLabelInput
          label="Your Name"
          value="J"
          onChangeText={() => {}}
          variant="name"
          errorMessage="Minimum 2 characters"
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Input Fields</Text>
      {inputItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 16 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── ProfileCard showcase ─────────────────────────────────────────────────────

const MOCK_IMG   = CDN_IMG + 'default-profile.jpg'
const MOCK_THUMB = CDN_IMG + 'default-profile.jpg'

const profileCardItems: { label: string; desc: string; node: React.ReactNode }[] = [
  {
    label: 'Variant 1 · newmatches',
    desc:  'Full-bleed photo with name + detail overlay. Used in New Matches list.',
    node: (
      <ProfileCard
        variant={1} section="newmatches"
        name="Priya Sharma" age="26 Yrs" education="B.Tech"
        profileImg={MOCK_IMG}
        onPress={() => Alert.alert('Card pressed')}
      />
    ),
  },
  {
    label: 'Variant 1 · dailyrecommendations',
    desc:  'Same overlay layout but adds a "View Details" primary button below photo.',
    node: (
      <ProfileCard
        variant={1} section="dailyrecommendations"
        name="Ananya Reddy" age="24 Yrs" education="MBA"
        profileImg={MOCK_IMG}
        onPress={() => Alert.alert('View Details')}
      />
    ),
  },
  {
    label: 'Variant 2 · likedyou',
    desc:  'Liked-you card with label text and Like / Call button.',
    node: (
      <ProfileCard
        variant={2} section="likedyou"
        name="Divya Nair" age="27 Yrs" education="MBBS"
        profileImg={MOCK_IMG}
        likedStatus="0"
        isNewLabel={false}
        likedViewedDateText="Liked you 2 days ago"
        onLikePress={() => Alert.alert('Like pressed')}
      />
    ),
  },
  {
    label: 'Variant 3 · viewedyou',
    desc:  'Viewed-by card with eye icon + date overlaid on photo, details below.',
    node: (
      <ProfileCard
        variant={3} section="viewedyou"
        name="Meena Krishnan" age="25 Yrs" height="5ft 3in" education="B.Com"
        profileImg={MOCK_IMG}
        isNewLabel={false}
        likedViewedDateText="Viewed on 11 Jan 2026"
        onPress={() => Alert.alert('View profile')}
      />
    ),
  },
  {
    label: 'Variant 4 · successstory',
    desc:  'Success story card — photo with couple name, location, date below.',
    node: (
      <ProfileCard
        variant={4} section="successstory"
        name="Raj & Priya" location="Chennai, Tamil Nadu"
        date="Posted on 20th Nov 2025"
        profileImg={MOCK_IMG}
        onPress={() => Alert.alert('Story pressed')}
      />
    ),
  },
  {
    label: 'Variant 5 · See All',
    desc:  '3 stacked avatar thumbnails + "See All" link. No photo — end-of-list card.',
    node: (
      <ProfileCard
        variant={5} section="matches"
        viewMoreContent="See All Matches"
        viewMoreList={[
          { THUMBIMG: MOCK_THUMB },
          { THUMBIMG: MOCK_THUMB },
          { THUMBIMG: MOCK_THUMB },
        ]}
        onViewMorePress={() => Alert.alert('See All pressed')}
      />
    ),
  },
  {
    label: 'Variant 6 · profileWithPhotos',
    desc:  'Basic photo card — image + name + detail below. No overlay.',
    node: (
      <ProfileCard
        variant={6} section="matches"
        name="Kavitha Sundaram" age="28 Yrs" education="CA"
        profileImg={MOCK_IMG}
        onPress={() => Alert.alert('Card pressed')}
      />
    ),
  },
  {
    label: 'Variant 7 · viewlater',
    desc:  'View-Later card — full photo (no overlay) with details below.',
    node: (
      <ProfileCard
        variant={7} section="viewlater"
        name="Lakshmi Venkat" age="23 Yrs" height="5ft 1in" education="B.Sc"
        profileImg={MOCK_IMG}
        onPress={() => Alert.alert('Card pressed')}
      />
    ),
  },
  {
    label: 'Variant 8 · likedprofile',
    desc:  'Profile I liked — photo with eye badge, details, and liked-date footer.',
    node: (
      <ProfileCard
        variant={8} section="likedprofile"
        name="Sangeetha Rajan" age="26 Yrs" height="5ft 4in" education="B.E"
        profileImg={MOCK_IMG}
        isNewLabel={true}
        labelContent="Viewed your profile"
        likedViewedDateText="You liked her on 14 Jan 2026"
        onPress={() => Alert.alert('Card pressed')}
      />
    ),
  },
]

function ProfileCardShowcase() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profile Card</Text>
      {profileCardItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 16 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── Loader showcase ──────────────────────────────────────────────────────────

function LoaderShowcase() {
  const [modalVisible, setModalVisible] = useState(false)

  const loaderItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'spinner',
      desc:  'General-purpose inline spinner. Used anywhere data is loading.',
      node:  <Loader variant="spinner" />,
    },
    {
      label: 'spinner · with message',
      desc:  'Same spinner with "Just a moment…" text below — replaces Angular loader.component.',
      node:  <Loader variant="spinner" message="Just a moment…" />,
    },
    {
      label: 'matchloader',
      desc:  'Larger spinner for the matches list full-page loading state.',
      node:  <Loader variant="matchloader" />,
    },
    {
      label: 'skeleton-dashboard',
      desc:  'Shimmer skeleton for daily-recommendation layout. Mirrors Angular dashboardSkull.',
      node:  <Loader variant="skeleton-dashboard" />,
    },
    {
      label: 'skeleton-matches',
      desc:  'Shimmer skeleton for matches grid — smaller cards (55.55vw variant).',
      node:  <Loader variant="skeleton-matches" />,
    },
    {
      label: 'ModalLoader',
      desc:  'Full-screen modal overlay loader — replaces Angular ModalController loader.',
      node: (
        <>
          <ModalLoader
            visible={modalVisible}
            message="Just a moment…"
            onDismiss={() => setModalVisible(false)}
          />
          <Text
            style={{ color: Colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center' }}
            onPress={() => setModalVisible(true)}
          >
            Tap to preview ModalLoader →
          </Text>
        </>
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Loader</Text>
      {loaderItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 12 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── Badge showcase ───────────────────────────────────────────────────────────

const CDN_BADGE = CDN_SVG

const badgeItems: { label: string; desc: string; node: React.ReactNode }[] = [
  {
    label: 'paid · no icon',
    desc:  'Gold background badge for premium / paid members.',
    node:  <Badge variant="paid" text="Paid Member" />,
  },
  {
    label: 'paid · with icon',
    desc:  'Same badge with a left image icon (matches Angular .paid-tag-position).',
    node:  <Badge variant="paid" text="Paid Member" imageUrl={CDN_BADGE + 'paid-member-icon.svg'} />,
  },
  {
    label: 'verified · hasInfo',
    desc:  'Blue verified badge with info icon at end.',
    node:  <Badge variant="verified" text="ID Verified" hasInfo />,
  },
  {
    label: 'newly-joined',
    desc:  'Green badge for profiles that joined recently.',
    node:  <Badge variant="newly-joined" text="Newly Joined" />,
  },
  {
    label: 'custom',
    desc:  'Neutral fallback — uses background/textPrimary colors for unrecognised classes.',
    node:  <Badge variant="custom" text="Custom Label" />,
  },
]

function BadgeShowcase() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Badge</Text>
      {badgeItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={styles.cardPreview}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── LinkCTA showcase ─────────────────────────────────────────────────────────

function LinkCTAShowcase() {
  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'default',
      desc:  'Context message + tappable call icon + contact. Used in shortlist / communication.',
      node: (
        <LinkCTA
          text="You have shortlisted this member."
          contact="+91 98765 43210"
          onPress={() => Alert.alert('Call', 'Initiating call...')}
        />
      ),
    },
    {
      label: 'no text',
      desc:  'Contact row only — text prop is empty string so message is hidden.',
      node: (
        <LinkCTA
          text=""
          contact="+91 99887 76655"
          onPress={() => Alert.alert('Call', 'Initiating call...')}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Link CTA</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={styles.cardPreview}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── Chip showcase ────────────────────────────────────────────────────────────

function ChipShowcase() {
  const [sel, setSel] = useState<string | null>(null)

  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'default',
      desc:  'Unselected chip — grey border, white background.',
      node:  <Chip label="Religion" />,
    },
    {
      label: 'selected',
      desc:  'Selected state — brand border, light pink background.',
      node:  <Chip label="Age" state="selected" />,
    },
    {
      label: 'checked',
      desc:  'Checked state — same border, even subtler fill.',
      node:  <Chip label="Height" state="checked" />,
    },
    {
      label: 'icon start · filter',
      desc:  'Filter icon at the start — Angular iconPosition=start, type=filter.',
      node:  <Chip label="Filter" icon="filter" iconPosition="start" />,
    },
    {
      label: 'icon end · forward',
      desc:  'Forward arrow at the end — Angular iconPosition=end, type=forward.',
      node:  <Chip label="Show More" icon="forward" iconPosition="end" />,
    },
    {
      label: 'icon end · tick · selected',
      desc:  'Tick icon + selected state — used when a filter option is active.',
      node:  <Chip label="Online Now" icon="tick" iconPosition="end" state="selected" />,
    },
    {
      label: 'count badge',
      desc:  'Red count badge overlaid on chip — Angular .count-chip-block-message.',
      node:  <Chip label="Filters" icon="filter" iconPosition="start" count={3} />,
    },
    {
      label: 'interactive — tap to toggle',
      desc:  'Tapping toggles selected state. Demonstrates onPress callback.',
      node: (
        <Chip
          label={sel === 'caste' ? 'Caste ✓' : 'Caste'}
          state={sel === 'caste' ? 'selected' : 'default'}
          icon="tick"
          iconPosition="end"
          onPress={() => setSel(p => p === 'caste' ? null : 'caste')}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Chip</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={styles.cardPreview}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── CheckboxGroup showcase ───────────────────────────────────────────────────

const RELIGION_OPTIONS: CheckboxOption[] = [
  { key: '1', value: 'Hindu',    checked: false },
  { key: '2', value: 'Muslim',   checked: false },
  { key: '3', value: 'Christian', checked: false },
  { key: '4', value: 'Jain',     checked: false },
  { key: '5', value: 'Sikh',     checked: false },
]

function CheckboxShowcase() {
  const [options, setOptions] = useState<CheckboxOption[]>(RELIGION_OPTIONS)

  function handleToggle(key: string, checked: boolean) {
    setOptions(prev => prev.map(o => o.key === key ? { ...o, checked } : o))
  }

  const multiOptions: CheckboxOption[] = [
    { key: 'a', value: 'Below 5 feet',         checked: true },
    { key: 'b', value: '5 feet – 5 feet 3 in', checked: false },
    { key: 'c', value: '5 feet 4 in – 5 feet 7 in', checked: true },
    { key: 'd', value: 'Above 5 feet 7 in',    checked: false },
  ]

  const [multiOpts, setMultiOpts] = useState(multiOptions)

  function handleMulti(key: string, checked: boolean) {
    setMultiOpts(prev => prev.map(o => o.key === key ? { ...o, checked } : o))
  }

  const checkItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'single selection (religion)',
      desc:  'Each row: label left, checkbox right. Checked row turns #FFF1F5. Controlled by parent.',
      node:  <CheckboxGroup options={options} onToggle={handleToggle} />,
    },
    {
      label: 'multi-checked (height range)',
      desc:  'Multiple items pre-checked. Mirrors Angular prefillValues() pattern.',
      node:  <CheckboxGroup options={multiOpts} onToggle={handleMulti} />,
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Checkbox</Text>
      {checkItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={styles.cardPreview}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── RadioGroup showcase ──────────────────────────────────────────────────────

const MARITAL_OPTIONS: RadioOption[] = [
  { key: '1', value: 'Never Married' },
  { key: '2', value: 'Divorced' },
  { key: '3', value: 'Widowed' },
  { key: '4', value: 'Awaiting Divorce' },
]

const HEIGHT_OPTIONS: RadioOption[] = [
  { key: '1', value: 'Below 5 feet',         value1: 'Shorter than 5 feet' },
  { key: '2', value: '5 feet – 5 feet 3 in', value1: '152 cm – 160 cm' },
  { key: '3', value: '5 feet 4 in – 5 feet 7 in', value1: '163 cm – 170 cm' },
  { key: '4', value: 'Above 5 feet 7 in',    value1: 'Taller than 170 cm' },
]

function RadioShowcase() {
  const [marital, setMarital] = useState('')
  const [height,  setHeight]  = useState('2')

  const radioItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'pill · type-1 (marital status)',
      desc:  'Horizontal wrapping pill chips. Angular TYPE=type-1 / .radio-options. '
           + 'Checked: brand border + near-transparent bg.',
      node: (
        <RadioGroup
          options={MARITAL_OPTIONS}
          value={marital}
          onChange={(key) => setMarital(key)}
          layout="pill"
        />
      ),
    },
    {
      label: 'list · type-2 (height)',
      desc:  'Full-width rows with optional subtitle. Angular TYPE=type-2 / .height-options. '
           + 'Checked row: #FFF1F5 bg.',
      node: (
        <RadioGroup
          options={HEIGHT_OPTIONS}
          value={height}
          onChange={(key) => setHeight(key)}
          layout="list"
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Radio Group</Text>
      {radioItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 12 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── SelectableCard showcase ──────────────────────────────────────────────────

function SelectableCardShowcase() {
  const [radioSel, setRadioSel] = useState<string | null>(null)
  const [checkSel, setCheckSel] = useState<Set<string>>(new Set())

  const cards = ['Option A — Standard membership', 'Option B — Premium membership', 'Option C — Trial plan']

  function toggleCheck(label: string) {
    setCheckSel(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const scItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'radio card group',
      desc:  'Bordered card list — single selection. Angular .radio-card with ion-radio slot=end.',
      node: (
        <View>
          {cards.map(c => (
            <SelectableCard
              key={c}
              label={c}
              type="radio"
              selected={radioSel === c}
              onPress={() => setRadioSel(c)}
            />
          ))}
        </View>
      ),
    },
    {
      label: 'checkbox card group',
      desc:  'Same card, checkbox indicator. Angular .checkbox-card with ion-checkbox slot=end.',
      node: (
        <View>
          {cards.map(c => (
            <SelectableCard
              key={c}
              label={c}
              type="checkbox"
              selected={checkSel.has(c)}
              onPress={() => toggleCheck(c)}
            />
          ))}
        </View>
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Selectable Card</Text>
      {scItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 12 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── Dropdown showcase ────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { key: '1', value: 'January' },  { key: '2', value: 'February' },
  { key: '3', value: 'March' },    { key: '4', value: 'April' },
  { key: '5', value: 'May' },      { key: '6', value: 'June' },
  { key: '7', value: 'July' },     { key: '8', value: 'August' },
  { key: '9', value: 'September' },{ key: '10', value: 'October' },
  { key: '11', value: 'November' },{ key: '12', value: 'December' },
]

const YEAR_OPTIONS = Array.from({ length: 40 }, (_, i) => {
  const y = (1985 + i).toString()
  return { key: y, value: y }
})

function DropdownShowcase() {
  const [month, setMonth] = useState('')
  const [year,  setYear]  = useState('2000')

  const ddItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'no value (placeholder)',
      desc:  'Shows labelName as placeholder. No floating label until selection made.',
      node: (
        <Dropdown
          label="Month"
          options={MONTH_OPTIONS}
          value={month}
          onSelect={(key, _) => setMonth(key)}
        />
      ),
    },
    {
      label: 'with value + floating label',
      desc:  'Pre-selected value. Floating label appears above border. Angular .floating-dob pattern.',
      node: (
        <Dropdown
          label="Year of Birth"
          options={YEAR_OPTIONS}
          value={year}
          onSelect={(key, _) => setYear(key)}
        />
      ),
    },
    {
      label: 'showFloatingLabel=false',
      desc:  'Floating label suppressed — trigger shows selected value inline only.',
      node: (
        <Dropdown
          label="Year"
          options={YEAR_OPTIONS}
          value={year}
          onSelect={(key, _) => setYear(key)}
          showFloatingLabel={false}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dropdown</Text>
      {ddItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { paddingTop: 12 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── ProfilePhoto showcase ────────────────────────────────────────────────────

const PHOTO_URL = CDN_IMG + 'default-profile.jpg'

function ProfilePhotoShowcase() {
  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'normal · matches variant',
      desc: 'Standard profile photo with bottom scrim and newly-joined badge.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isNewlyJoined={true}
          onPress={() => Alert.alert('Photo pressed')}
        />
      ),
    },
    {
      label: 'protected · BlurView overlay',
      desc: 'isPhotoProtect=true — photo is blurred with expo-blur + view-photo-request overlay.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isPhotoAvailable={true}
          isPhotoProtect={true}
          showReqPhotoElement={true}
          onViewPhotoRequest={() => Alert.alert('View photo request sent')}
        />
      ),
    },
    {
      label: 'no photo · add-photo request',
      desc: 'isPhotoAvailable=false — shows add-photo request CTA overlay.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isPhotoAvailable={false}
          showReqPhotoElement={true}
          isAddPhotoRequest={false}
          onAddPhotoRequest={() => Alert.alert('Add photo request sent')}
        />
      ),
    },
    {
      label: 'no photo · request already sent',
      desc: 'isAddPhotoRequest=true — "Request Sent" state, button hidden.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isPhotoAvailable={false}
          showReqPhotoElement={true}
          isAddPhotoRequest={true}
        />
      ),
    },
    {
      label: 'shortlist pill + don\'t show',
      desc: 'Shortlist pill (top-right) and Don\'t Show pill (bottom-center) overlays.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isShortlisted={true}
          likedStatus="0"
          showDontShow={true}
          onShortlistPress={() => Alert.alert('Shortlist pressed')}
          onDontShowPress={() => Alert.alert('Don\'t show pressed')}
        />
      ),
    },
    {
      label: 'own photo · upload CTA',
      desc: 'isOwnPhoto=true — shows camera upload overlay. Tapping opens gallery/camera picker.',
      node: (
        <ProfilePhoto
          profileImage={PHOTO_URL}
          height={220}
          variant="matches"
          isOwnPhoto={true}
          onPhotoUpload={(uri) => Alert.alert('Photo selected', uri)}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profile Photo</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { overflow: 'hidden', borderRadius: 12 }]}>
            {item.node}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── MatchesCard showcase ─────────────────────────────────────────────────────

const MATCHES_IMG = [
  { IMAGE: CDN_IMG + 'default-profile.jpg' },
  { IMAGE: CDN_IMG + 'default-profile.jpg' },
]

function MatchesCardShowcase() {
  const [likedStatus, setLikedStatus] = useState<'0' | '1' | '2' | '3'>('0')

  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'not liked · 2-photo swiper',
      desc:  'Standard matches card. Photo swiper + name row + Don\'t Show / View Later / Like CTAs.',
      node: (
        <MatchesCard
          name="Priya Sharma"
          age="26 Yrs" height="5ft 4in" caste="Brahmin"
          education="MBA" occupation="Software Engineer"
          city="Chennai" state="Tamil Nadu"
          profileImageArr={MATCHES_IMG}
          likedStatus={likedStatus}
          variant="matches"
          onViewProfile={() => Alert.alert('View Profile')}
          onLike={() => { Alert.alert('Liked!'); setLikedStatus('1') }}
          onDontShow={() => Alert.alert('Don\'t Show')}
          onViewLater={() => Alert.alert('View Later')}
          onCall={() => Alert.alert('Call')}
          onWhatsApp={() => Alert.alert('WhatsApp')}
        />
      ),
    },
    {
      label: 'after like · contact CTA',
      desc:  'likedStatus="1" — shows "View Contact" primary button and post-like message.',
      node: (
        <MatchesCard
          name="Divya Krishnan"
          age="24 Yrs" height="5ft 2in" caste="Nadar"
          education="B.Tech" occupation="Doctor"
          city="Coimbatore" state="Tamil Nadu"
          profileImageArr={[MATCHES_IMG[0]!]}
          likedStatus="1"
          variant="matches"
          isPaidMember={true}
          onViewProfile={() => Alert.alert('View Profile')}
          onCall={() => Alert.alert('Call')}
          onWhatsApp={() => Alert.alert('WhatsApp')}
        />
      ),
    },
    {
      label: 'mutual match · paid + verified badges',
      desc:  'likedStatus="2" — mutual match. Paid Member + ID Verified badges shown.',
      node: (
        <MatchesCard
          name="Ananya Reddy"
          age="27 Yrs" height="5ft 5in"
          education="CA" occupation="Chartered Accountant"
          city="Bangalore" state="Karnataka"
          profileImageArr={[MATCHES_IMG[0]!]}
          likedStatus="2"
          variant="matches"
          isPaidMember={true}
          isIdVerifiedMember={true}
          isNewlyJoined={true}
          onViewProfile={() => Alert.alert('View Profile')}
          onCall={() => Alert.alert('Call Now')}
        />
      ),
    },
    {
      label: 'activity label · who viewed you',
      desc:  'isActivityLabel=true — shows activity icon + label text (viewedyou / likedyou sections).',
      node: (
        <MatchesCard
          name="Meena Venkat"
          age="25 Yrs" education="B.Com"
          city="Madurai" state="Tamil Nadu"
          profileImageArr={[MATCHES_IMG[0]!]}
          likedStatus="0"
          variant="activity"
          isActivityLabel={true}
          LabelText="Viewed your profile on 14 Jan 2026"
          onViewProfile={() => Alert.alert('View Profile')}
          onLike={() => Alert.alert('Like')}
          onDontShow={() => Alert.alert('Don\'t Show')}
          onViewLater={() => Alert.alert('View Later')}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Matches Card</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { padding: 0 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── SwiperCard showcase ──────────────────────────────────────────────────────

function SwiperCardShowcase() {
  const swiperItems = [
    {
      profileId: 'S1', name: 'Priya S.', age: '26 Yrs', education: 'MBA',
      profileImg: CDN_IMG + 'default-profile.jpg',
      likedStatus: '0' as const,
    },
    {
      profileId: 'S2', name: 'Divya K.', age: '24 Yrs', education: 'B.Tech',
      profileImg: CDN_IMG + 'default-profile.jpg',
      likedStatus: '1' as const, isNewlyJoined: true,
    },
    {
      profileId: 'S3', name: 'Ananya R.', age: '27 Yrs', education: 'CA',
      profileImg: CDN_IMG + 'default-profile.jpg',
      likedStatus: '0' as const,
    },
    {
      profileId: 'S4', name: 'Meena V.', age: '25 Yrs', education: 'B.Com',
      profileImg: CDN_IMG + 'default-profile.jpg',
      likedStatus: '2' as const,
    },
  ]

  const scItems: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'Who Viewed You · newmatches',
      desc:  'Horizontal section with header, count badge, and "See All" card at end.',
      node: (
        <SwiperCard
          swiperHeader="Who Viewed You"
          newCount={12}
          cardVariant={1}
          cardSection="newmatches"
          items={swiperItems}
          onCardPress={(item) => Alert.alert('Card', item.name ?? '')}
          onSeeAllPress={() => Alert.alert('See All')}
        />
      ),
    },
    {
      label: 'Who Liked You · likedyou',
      desc:  'Same section with likedyou card layout — shows Like / Call CTA row per card.',
      node: (
        <SwiperCard
          swiperHeader="Who Liked You"
          newCount={3}
          cardVariant={2}
          cardSection="likedyou"
          items={swiperItems}
          onCardPress={(item) => Alert.alert('Card', item.name ?? '')}
          onLikePress={(item) => Alert.alert('Like', item.name ?? '')}
          onSeeAllPress={() => Alert.alert('See All')}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Swiper Card (Horizontal Section)</Text>
      {scItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { padding: 0 }]}>{item.node}</View>
        </View>
      ))}
    </View>
  )
}

// ─── AppHeader showcase ───────────────────────────────────────────────────────

const MOCK_USER_IMG = CDN_IMG + 'default-profile.jpg'
const MOCK_NOTIFICATION_ICON = CDN_SVG + 'revamp/notification.svg'
const MOCK_CHAT_ICON = CDN_SVG + 'revamp/chat.svg'

function AppHeaderShowcase() {
  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'header1 · home (no badge)',
      desc:  'Home page header — avatar + name + Edit Profile link. Toolbar icons with notification/chat.',
      node: (
        <AppHeader
          type="header1"
          userImg={MOCK_USER_IMG}
          userName="Priya Sharma"
          hasPaidBatch={false}
          homeToolBar={[
            { toolType: 'notification', toolImg: MOCK_NOTIFICATION_ICON, showNotification: true, notifyCount: '3' },
            { toolType: 'messager-list', toolImg: MOCK_CHAT_ICON, showNotification: true, notifyCount: '12' },
          ]}
          onMenuPress={() => Alert.alert('Menu')}
          onAvatarPress={() => Alert.alert('Avatar pressed')}
          onEditProfilePress={() => Alert.alert('Edit Profile')}
          onToolbarItemPress={t => Alert.alert('Toolbar', t)}
          style={{ paddingTop: 0 }}
        />
      ),
    },
    {
      label: 'header1 · home (paid badge)',
      desc:  'Same home header with paid member badge row. Shown for verified paid male users.',
      node: (
        <AppHeader
          type="header1"
          userImg={MOCK_USER_IMG}
          userName="Priya Sharma"
          hasPaidBatch={true}
          homeToolBar={[
            { toolType: 'notification', toolImg: MOCK_NOTIFICATION_ICON },
          ]}
          onMenuPress={() => Alert.alert('Menu')}
          onEditProfilePress={() => Alert.alert('Edit Profile')}
          style={{ paddingTop: 0 }}
        />
      ),
    },
    {
      label: 'header2 · title bar (with back)',
      desc:  'Simple back + title layout. Used on My Membership, Notification, etc.',
      node: (
        <AppHeader
          type="header2"
          title="My Membership"
          showBackIcon={true}
          onBackPress={() => Alert.alert('Back pressed')}
          style={{ paddingTop: 0 }}
        />
      ),
    },
    {
      label: 'header2 · title bar (no back)',
      desc:  'Title bar without back button — used on pages with BACK_ICON=0.',
      node: (
        <AppHeader
          type="header2"
          title="Notifications"
          showBackIcon={false}
          style={{ paddingTop: 0 }}
        />
      ),
    },
    {
      label: 'registration / signIn',
      desc:  'Auth header — optional back button + language picker on the right.',
      node: (
        <AppHeader
          type="registration"
          showBackBtn={true}
          languageLabel="English"
          onBackPress={() => Alert.alert('Back')}
          onLanguagePress={() => Alert.alert('Language picker')}
          style={{ paddingTop: 0 }}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>App Header</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { overflow: 'hidden', borderRadius: 8 }]}>
            {item.node}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── AppFooter showcase ───────────────────────────────────────────────────────

function AppFooterShowcase() {
  const [activeTab, setActiveTab] = useState<FooterTab>(1)

  const items: { label: string; desc: string; node: React.ReactNode }[] = [
    {
      label: 'interactive tab bar',
      desc:  'Tap any tab to switch active state. Mirrors Angular footer ion-tab-bar.',
      node: (
        <AppFooter
          activeTab={activeTab}
          exploreCount={5}
          likesCount={3}
          chatCount={12}
          upgradeTag="₹200 OFF"
          onTabPress={t => setActiveTab(t)}
        />
      ),
    },
    {
      label: 'no badges · paid member',
      desc:  'All counts zero, no upgrade tag — state for paid / active members.',
      node: (
        <AppFooter
          activeTab={0}
          onTabPress={() => {}}
        />
      ),
    },
    {
      label: 'membership dot warning',
      desc:  'Red dot on Membership tab — shown when membership is expiring soon.',
      node: (
        <AppFooter
          activeTab={3}
          showMembershipDot={true}
          upgradeTag="Renew"
          onTabPress={() => {}}
        />
      ),
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>App Footer (Tab Bar)</Text>
      {items.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={[styles.cardPreview, { padding: 0, overflow: 'hidden', borderRadius: 8 }]}>
            {item.node}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── BottomSheet showcase ─────────────────────────────────────────────────────

type SheetVariant = { label: string; desc: string; type: BottomSheetType; data: BottomSheetData }

const SHEET_VARIANTS: SheetVariant[] = [
  {
    label: 'infoPromo · standard',
    desc:  'Title + content + primary CTA + OR separator + link CTA. Most common bottom sheet layout.',
    type:  'infoPromo',
    data: {
      title:        'Upgrade Your Plan',
      content:      'Connect with more profiles and get unlimited access to contact details.',
      ctaLabel:     'View Plans',
      orCtaText:    'OR',
      linkCtaLabel: 'Maybe Later',
      showClose:    true,
    },
  },
  {
    label: 'blockProfile · side-by-side CTAs',
    desc:  'Cancel + Block in a row. showSecondaryCta + sideBySideCtas = true.',
    type:  'blockProfile',
    data: {
      title:              'Block this Profile?',
      content:            'They will no longer be able to view your profile or contact you.',
      ctaLabel:           'Block',
      secondaryCtaLabel:  'Cancel',
      showSecondaryCta:   true,
      sideBySideCtas:     true,
      showClose:          false,
    },
  },
  {
    label: 'payment · with image',
    desc:  'Top illustration + title + content + upgrade CTA. Matches Angular payment bottomsheet.',
    type:  'payment',
    data: {
      image:     CDN_SVG + 'profile-not-activated-img.svg',
      title:     'Become a Premium Member',
      content:   'Send unlimited likes and get priority placement in search results.',
      ctaLabel:  'Upgrade Now',
      showClose: true,
    },
  },
  {
    label: 'reportProfile · secondary CTA (stacked)',
    desc:  'Primary + secondary stacked vertically. showSecondaryCta=true, sideBySideCtas=false.',
    type:  'reportProfile',
    data: {
      title:              'Report Profile',
      content:            'Help us keep Jodii safe. Select a reason to report this profile.',
      ctaLabel:           'Report',
      secondaryCtaLabel:  'Cancel',
      showSecondaryCta:   true,
      sideBySideCtas:     false,
      showClose:          true,
    },
  },
]

function BottomSheetShowcase() {
  const [activeType, setActiveType] = useState<BottomSheetType | null>(null)
  const activeVariant = SHEET_VARIANTS.find(v => v.type === activeType)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Bottom Sheet</Text>

      {SHEET_VARIANTS.map(v => (
        <View key={v.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{v.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{v.desc}</Text>
          <View style={styles.cardPreview}>
            <Pressable
              onPress={() => setActiveType(v.type)}
              style={styles.showSheetBtn}
            >
              <Text style={styles.showSheetBtnText}>Show Bottom Sheet →</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <BottomSheet
        visible={activeType !== null}
        type={activeType ?? 'infoPromo'}
        data={activeVariant?.data}
        onClose={() => setActiveType(null)}
        onPrimaryPress={() => { Alert.alert('Primary CTA'); setActiveType(null) }}
        onSecondaryPress={() => { Alert.alert('Secondary CTA'); setActiveType(null) }}
        onLinkPress={() => { Alert.alert('Link CTA'); setActiveType(null) }}
      />
    </View>
  )
}

// ─── Popover showcase ─────────────────────────────────────────────────────────

function PopoverShowcase() {
  const [activePopover, setActivePopover] = useState<PopoverType | null>(null)

  const popoverItems: { label: string; desc: string; type: PopoverType; title?: string; content: string }[] = [
    {
      label:   'attentionPopup',
      desc:    'Small info card with title + body + "Got It" button. Used for contextual warnings.',
      type:    'attentionPopup',
      title:   'Attention',
      content: 'Members who deleted their profile after you viewed their phone number are removed from the list.',
    },
    {
      label:   'verifiedPopup',
      desc:    'Tiny tooltip anchored near a badge icon (e.g. "Verified via Call").',
      type:    'verifiedPopup',
      content: 'Verified via Call',
    },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Popover</Text>

      {popoverItems.map(item => (
        <View key={item.label} style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.label}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.desc}</Text>
          <View style={styles.cardPreview}>
            <Pressable
              onPress={() => setActivePopover(item.type)}
              style={styles.showSheetBtn}
            >
              <Text style={styles.showSheetBtnText}>Show Popover →</Text>
            </Pressable>
          </View>

          {/* Render each popover separately so positioning is correct */}
          <Popover
            visible={activePopover === item.type}
            type={item.type}
            title={item.title}
            content={item.content}
            onClose={() => setActivePopover(null)}
          />
        </View>
      ))}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ComponentShowcaseScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Component Library</Text>
      <Text style={styles.pageSubtitle}>
        {totalItems} button variants across {sections.length} categories · Input Fields
      </Text>

      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          {section.items.map(item => (
            <View key={item.label} style={styles.card}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.label}</Text>
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
              <View style={styles.cardPreview}>{item.node}</View>
            </View>
          ))}
        </View>
      ))}

      <InputShowcase />
      <ProfileCardShowcase />
      <LoaderShowcase />
      <BadgeShowcase />
      <LinkCTAShowcase />
      <ChipShowcase />
      <CheckboxShowcase />
      <RadioShowcase />
      <SelectableCardShowcase />
      <DropdownShowcase />
      <AppHeaderShowcase />
      <AppFooterShowcase />
      <ProfilePhotoShowcase />
      <MatchesCardShowcase />
      <SwiperCardShowcase />
      <BottomSheetShowcase />
      <PopoverShowcase />
    </ScrollView>
  )
}

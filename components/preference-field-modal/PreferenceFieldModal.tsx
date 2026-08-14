// Desktop-web "edit one preference field" popup (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 647:13268 — the "Select
// preferred age" popup). One shared shell reused for all 15 Edit Preferences
// fields (SearchDesktopLayout.tsx) — Figma only provided this single field's
// popup, but every other field follows the exact same chrome (close X, title,
// field control(s), a "Strict {field} filter" toggle, description, live
// Matches count + Apply), just with a different control inside `children`.
//
// Unlike DesktopSelectField's own immediate-commit convention (used elsewhere
// in this app for onboarding), Figma's popup has an explicit Apply button —
// SearchDesktopLayout stages edits locally and only commits them to the real
// filter state when Apply is pressed here, matching mobile's own
// MultiSelectPicker/SearchablePicker "Apply" semantics.
import { Modal, Pressable, StyleSheet, Text, View, Switch } from 'react-native'
import { Colors } from '../../constants/colors'

export interface PreferenceFieldModalProps {
  visible:           boolean
  title:             string
  onClose:           () => void
  onApply:           () => void
  matchCount:        number
  countLoading:      boolean
  strictLabel:       string
  strictDescription: string
  strictEnabled:     boolean
  onToggleStrict:    (value: boolean) => void
  // Angular: filter-popup.component.ts's showStrictFilter getter — Occupation
  // is excluded from strict filtering entirely, and any field left at "Any"
  // has nothing to strictly match against yet. Defaults true so every other
  // existing call site keeps showing the toggle unchanged.
  showStrict?:       boolean
  children:          React.ReactNode
}

export default function PreferenceFieldModal({
  visible, title, onClose, onApply, matchCount, countLoading,
  strictLabel, strictDescription, strictEnabled, onToggleStrict, showStrict = true, children,
}: PreferenceFieldModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.closeX}>✕</Text>
          </Pressable>

          <Text style={s.title}>{title}</Text>

          <View style={s.body}>{children}</View>

          {/* Figma: "Strict age filter" toggle — persisted locally only (see
              SearchScreen.tsx's strictPrefs comment for why this isn't sent
              to the search API yet). */}
          {showStrict && (
            <View style={s.strictBanner}>
              <View style={s.strictTextCol}>
                <Text style={s.strictTitle}>{strictLabel}</Text>
                <Text style={s.strictDesc}>{strictDescription}</Text>
              </View>
              <Switch
                value={strictEnabled}
                onValueChange={onToggleStrict}
                trackColor={{ true: Colors.primaryDark, false: Colors.border }}
              />
            </View>
          )}

          <View style={s.footer}>
            <View style={s.matchesCol}>
              <Text style={s.matchesLabel}>Matches</Text>
              <Text style={s.matchesCount}>{countLoading ? '…' : matchCount.toLocaleString('en-IN')}</Text>
            </View>
            <Pressable style={s.applyBtn} onPress={onApply}>
              <Text style={s.applyText}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: 408, maxWidth: '92%', backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, gap: 24, alignItems: 'flex-end',
  },
  closeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 16, color: Colors.black },

  title: {
    alignSelf: 'stretch', textAlign: 'center',
    fontFamily: 'Poppins-SemiBold', fontSize: 18, lineHeight: 24, color: Colors.black,
  },
  // zIndex here (not just on DesktopSelectField's own internal wrapperOpen)
  // is what actually lets an open dropdown escape ABOVE this View's own
  // siblings below it (strictBanner, footer) — a child's z-index can only
  // out-rank its own siblings, never a parent's siblings, so without this,
  // the strict-filter banner painted over an open dropdown's lower rows.
  body: { alignSelf: 'stretch', gap: 20, zIndex: 10 },

  strictBanner: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC',
    borderRadius: 8, padding: 12,
  },
  strictTextCol: { flex: 1, gap: 4 },
  strictTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, lineHeight: 20, color: Colors.black },
  strictDesc:  { fontFamily: 'Poppins-Regular', fontSize: 12, lineHeight: 16, color: Colors.black },

  footer: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 26,
  },
  matchesCol: { gap: 4 },
  matchesLabel: { fontFamily: 'Poppins-Regular', fontSize: 12, lineHeight: 20, color: Colors.black },
  matchesCount: { fontFamily: 'Poppins-SemiBold', fontSize: 14, lineHeight: 20, color: Colors.black },
  applyBtn: {
    flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  applyText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
})

// The 3-dot dropdown shown top-right of a profile card's photo — Angular:
// report-remove-profile.component.html/.ts/.scss. Verified directly against
// that source (not a guess): it's a plain absolutely-positioned dropdown
// panel anchored just below the 3-dot button (`position: absolute; right:
// 12px; top: 48px; z-index: 9999`), NOT a native action sheet / bottom
// sheet — a previous version of this port used a plain Alert.alert instead,
// which looks nothing like this and has no icons.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const REMOVE_ICON_URI = CDN_SVG + 'remove-photo-img.svg'
const REPORT_ICON_URI = CDN_SVG + 'viewprofile/report-profile-img.svg'

export interface ThreeDotMenuProps {
  // Angular: report-remove-profile.component.ts's @Input IsShowRemoveProfile/
  // IsShowReportProfile — both default false, caller opts each in. Order is
  // fixed in the real markup: Remove ABOVE Report when both show.
  showRemove: boolean
  showReport: boolean
  onRemove:   () => void
  onReport:   () => void
  // Desktop cards anchor this button inline in the icon row (relatively
  // positioned wrapper), not floating over the whole card's photo like
  // mobile does — override top/right to anchor to that smaller wrapper.
  positionStyle?: StyleProp<ViewStyle>
}

export default function ThreeDotMenu({ showRemove, showReport, onRemove, onReport, positionStyle }: ThreeDotMenuProps) {
  const { t } = useTranslation()
  return (
    <View style={[s.dropdown, positionStyle]}>
      {showRemove && (
        <Pressable style={s.item} onPress={onRemove}>
          <CdnSvg uri={REMOVE_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MATCHES.REMOVEPROFILE')}</Text>
        </Pressable>
      )}
      {showReport && (
        <Pressable style={s.item} onPress={onReport}>
          <CdnSvg uri={REPORT_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MATCHES.MORE_OPT_2')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  // Angular: .report-remove-profile { position: absolute; right: 12px;
  // top: 48px; z-index: 9999 } / .report-text { box-shadow: 0px 1px 8px -4px
  // #888; border-radius: 6px; padding: 0 } — no backdrop/overlay in the real
  // component; dismissal is purely the parent toggling visibility.
  dropdown: {
    position: 'absolute', top: 48, right: 12, zIndex: 9999,
    backgroundColor: Colors.white, borderRadius: 6, minWidth: 190,
    shadowColor: '#888888', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4,
    elevation: 6,
  },
  // Angular: .report-bg { --inner-padding-start: 16px } + ion-img mr-4.
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  itemText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
})

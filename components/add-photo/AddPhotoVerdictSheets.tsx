// One-line companion to hooks/useAddPhotoPicker.ts, paired the same way
// WebPhotoInput.tsx is — every screen that renders <WebPhotoInput> for that
// hook's web upload path should render this alongside it, so the AI
// photo-validation verdict (uploaded via AIVALIDATE, but previously never
// read back on this hook's web path) actually surfaces to the user.
import { useTranslation } from 'react-i18next'
import PhotoVerdictSheet from '../photo-validation/PhotoVerdictSheet'
import VerificationSuccessSheet from '../bottom-sheet/VerificationSuccessSheet'
import type { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'

type Props = {
  addPhoto: ReturnType<typeof useAddPhotoPicker>
}

export default function AddPhotoVerdictSheets({ addPhoto }: Props) {
  const { t } = useTranslation()
  const { verdictPhase, verdictApproved, verdictRejected, dismissVerdict, retryFromVerdict } = addPhoto

  return (
    <>
      <VerificationSuccessSheet
        visible={verdictPhase === 'approved'}
        title={verdictApproved.length > 1
          ? t('AI_PHOTO_VALIDATION.PHOTOS_APPROVED_MULTI', '#COUNT Photos approved successfully!').replace('#COUNT', String(verdictApproved.length))
          : t('AI_PHOTO_VALIDATION.PHOTO_APPROVED_SINGLE', 'Photo approved successfully!')}
        subtitle=""
        onDismiss={dismissVerdict}
      />
      <PhotoVerdictSheet
        visible={verdictPhase === 'uploading' || verdictPhase === 'rejected' || verdictPhase === 'mixed'}
        phase={verdictPhase === 'uploading' ? 'uploading' : verdictPhase === 'mixed' ? 'mixed' : 'rejected'}
        approved={verdictApproved}
        rejected={verdictRejected}
        onAddNewPhoto={retryFromVerdict}
        onDismiss={dismissVerdict}
      />
    </>
  )
}

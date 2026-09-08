// Hidden file input paired with hooks/useAddPhotoPicker.ts's openAddPhoto().
// Renders nothing on native — expo-media-library backs the Gallery screen there
// instead. Not display:none: Safari silently blocks a programmatic .click() on
// a display:none file input (see EditProfileDesktopScreen.tsx's fix for the
// same bug), so it's 1x1/opacity:0 instead.
import { Platform } from 'react-native'

type Props = {
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: any) => void
}

export default function WebPhotoInput({ inputRef, onChange }: Props) {
  if (Platform.OS !== 'web') return null
  return (
    // @ts-ignore — raw DOM element, react-native-web only
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
      onChange={onChange}
    />
  )
}

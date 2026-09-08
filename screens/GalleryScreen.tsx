import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { StorageKeys as SK } from '../constants/storage.keys';
import { Endpoints } from '../service/api.endpoints';
import { uploadFile } from '../service/apiClient';
import {
  describeRejection,
  getPhotoConfig,
  getRejectReasons,
  validatePhotoAsset,
  type PhotoRejectionCode,
} from '../service/photoValidationService';
import { getItem, setItem } from '../service/storageService';

const NUM_COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const PAGE_SIZE = 60;

type Asset = MediaLibrary.Asset;
type Album = MediaLibrary.Album;

type AlbumItem = {
  id: string;
  title: string;
  assetCount: number;
};

const ALL_PHOTOS: AlbumItem = { id: '__all__', title: 'All Photos', assetCount: 0 };

// A leading 'camera' entry alongside the picked-from-library Assets — same
// grid shape screens/onboarding/CustomGalleryScreen.tsx's ListItem uses for
// its own camera cell.
type ListItem = 'camera' | Asset;

type Props = {
  navigation: { goBack: () => void };
  onDone?: (assets: Asset[]) => void;
  maxSelection?: number;
};

// ─── Camera icon ──────────────────────────────────────────────────────────
// Ported verbatim from CustomGalleryScreen.tsx's CameraIcon — same asset/
// interaction pattern, reused rather than reinvented.
function CameraIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke="#fff" strokeWidth={1.8} />
    </Svg>
  );
}

// Guesses a MIME type from the asset's filename extension — expo-media-library's
// legacy Asset shape has no mimeType/fileSize field of its own (unlike an
// expo-image-picker asset), so this is the only format signal validatePhotoAsset
// can be given here.
function guessMimeType(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (ext === 'jpg') return 'image/jpeg';
  return `image/${ext}`;
}

// Same cap as the onboarding gallery's own MAX_PHOTOS
// (screens/onboarding/CustomGalleryScreen.tsx) — a profile can hold at most
// 10 photos total, not a UI-only limit.
const DEFAULT_MAX_SELECTION = 10;

export default function GalleryScreen({ navigation, onDone, maxSelection = DEFAULT_MAX_SELECTION }: Props) {
  const insets = useSafeAreaInsets();

  const [permission, setPermission]       = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [assets, setAssets]               = useState<Asset[]>([]);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [albums, setAlbums]               = useState<AlbumItem[]>([]);
  const [activeAlbum, setActiveAlbum]     = useState<AlbumItem>(ALL_PHOTOS);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [uploading, setUploading]         = useState(false);
  const endCursorRef = useRef<string | undefined>(undefined);

  // ─── Permission + initial load ────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        setPermission('denied');
        setLoading(false);
        return;
      }
      // Explicit granularPermissions: ['photo'] — this screen only ever
      // reads photo assets (loadPhotos() always passes mediaType: 'photo'),
      // but on Android 13+ an unqualified requestPermissionsAsync() call
      // defaults to requesting ALL granular permissions (photo, video, AND
      // audio), which is what was surfacing as an unexpected "Allow Music
      // and audio access" dialog. Same fix applied in the sibling
      // CustomGalleryScreen.tsx.
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status === 'granted') {
        setPermission('granted');
        await Promise.all([loadPhotos(), loadAlbums()]);
      } else {
        setPermission('denied');
        setLoading(false);
      }
    })();
  }, []);

  // ─── Fetch albums ─────────────────────────────────────────────────────────

  const loadAlbums = useCallback(async () => {
    const raw: Album[] = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    // Only keep albums that actually have photos
    const filtered: AlbumItem[] = raw
      .filter(a => (a.assetCount ?? 0) > 0)
      .map(a => ({ id: a.id, title: a.title, assetCount: a.assetCount ?? 0 }))
      .sort((a, b) => b.assetCount - a.assetCount);
    setAlbums(filtered);
  }, []);

  // ─── Fetch photos (paginated) ─────────────────────────────────────────────

  const loadPhotos = useCallback(async (after?: string, album?: AlbumItem) => {
    try {
      const opts: MediaLibrary.AssetsOptions = {
        mediaType: 'photo',
        first: PAGE_SIZE,
        sortBy: MediaLibrary.SortBy.creationTime,
      };
      if (after) opts.after = after;
      if (album && album.id !== ALL_PHOTOS.id) opts.album = album.id;

      const result = await MediaLibrary.getAssetsAsync(opts);
      setAssets(prev => after ? [...prev, ...result.assets] : result.assets);
      setHasMore(result.hasNextPage);
      endCursorRef.current = result.endCursor;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Re-load photos whenever active album changes
  const selectAlbum = useCallback((album: AlbumItem) => {
    setShowDropdown(false);
    setActiveAlbum(album);
    setAssets([]);
    setSelected(new Set());
    setHasMore(true);
    endCursorRef.current = undefined;
    setLoading(true);
    loadPhotos(undefined, album);
  }, [loadPhotos]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    loadPhotos(endCursorRef.current, activeAlbum);
  }, [hasMore, loadingMore, loadPhotos, activeAlbum]);

  // ─── Selection logic ──────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    // Previously this silently no-opped once the cap was hit, with no
    // feedback at all — reusing the same "Photo limit reached" alert pattern
    // CustomGalleryScreen.web.tsx already uses for its own max-selection
    // guard, worded to match the equivalent Android copy ("You cannot upload
    // more than %1$s photos.").
    if (!selected.has(id) && maxSelection && selected.size >= maxSelection) {
      Alert.alert('Photo limit reached', `You cannot upload more than ${maxSelection} photos.`);
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [selected, maxSelection]);

  // Shared upload path for both the "Done" multi-select flow and the camera
  // cell's single just-captured photo — factored out of what used to be
  // handleDone's own body so the camera cell (added for QA #52) doesn't have
  // to duplicate the validate/upload/reject-alert logic.
  const uploadPhotos = useCallback(async (
    items: { uri: string; filename: string; mimeType?: string | undefined; width?: number | undefined; height?: number | undefined }[],
  ) => {
    if (items.length === 0) return;

    setUploading(true);
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? '';
      const config = await getPhotoConfig();
      const rejections: PhotoRejectionCode[] = [];

      for (const item of items) {
        const validation = await validatePhotoAsset({
          uri: item.uri,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
        }, config);
        if (!validation.ok) {
          rejections.push(validation.code);
          continue;
        }

        const formData = new FormData();
        formData.append('ID', userId);
        formData.append('AIVALIDATE', config.isNativeFaceDetectionEnabled ? '1' : '0');
        formData.append('UPLOADPHOTO', {
          uri: item.uri,
          type: item.mimeType ?? 'image/jpeg',
          name: item.filename,
        } as any);

        const res = await uploadFile(Endpoints.media.addProfilePic, formData);
        if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOURL) {
          await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL));
        }
      }

      if (rejections.length) {
        const reasons = await getRejectReasons();
        Alert.alert(
          'Some photos were not added',
          rejections.map(code => describeRejection(code, reasons)).join('\n\n'),
        );
      }
      if (rejections.length < items.length) {
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [navigation]);

  // Screen is mounted as a plain Stack.Screen (navigation.navigate('Gallery')) from
  // many call sites, none of which pass params — React Navigation only ever injects
  // navigation/route into a route component, never an arbitrary onDone prop. So the
  // upload has to happen right here instead of being handed back to a caller.
  const handleDone = useCallback(async () => {
    const selectedAssets = assets.filter(a => selected.has(a.id));
    if (selectedAssets.length === 0) return;

    onDone?.(selectedAssets);

    await uploadPhotos(selectedAssets.map(asset => ({
      uri: asset.uri,
      filename: asset.filename,
      mimeType: guessMimeType(asset.filename),
      width: asset.width,
      height: asset.height,
    })));
  }, [assets, selected, onDone, uploadPhotos]);

  // ─── Camera ───────────────────────────────────────────────────────────────
  // Ported from CustomGalleryScreen.tsx's openCamera() — same permission
  // check + launchCameraAsync call, then routed through this screen's own
  // uploadPhotos() above instead of that screen's uploadAndNavigate().
  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    });
    if (!result.canceled) {
      const captured = result.assets[0];
      await uploadPhotos([{
        uri: captured.uri,
        filename: captured.fileName ?? 'photo.jpg',
        mimeType: captured.mimeType,
        width: captured.width,
        height: captured.height,
      }]);
    }
  }, [uploadPhotos]);

  // ─── Render tile ──────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item, index }: { item: ListItem; index: number }) => {
    const col = index % NUM_COLUMNS;
    const marginLeft  = col === 0 ? GAP : GAP / 2;
    const marginRight = col === NUM_COLUMNS - 1 ? GAP : GAP / 2;

    if (item === 'camera') {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openCamera}
          style={[styles.tile, styles.cameraTile, { marginLeft, marginRight, marginBottom: GAP }]}
        >
          <CameraIcon />
          <Text style={styles.cameraLabel}>Camera</Text>
        </TouchableOpacity>
      );
    }

    const isSelected = selected.has(item.id);
    const selectionIndex = isSelected ? [...selected].indexOf(item.id) + 1 : null;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleSelect(item.id)}
        style={[styles.tile, { marginLeft, marginRight, marginBottom: GAP }]}
      >
        <Image source={item.uri} style={styles.tileImage} contentFit="cover" />
        {isSelected && <View style={styles.selectedOverlay} />}
        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
          {isSelected && <Text style={styles.badgeText}>{selectionIndex}</Text>}
        </View>
      </TouchableOpacity>
    );
  }, [selected, toggleSelect, openCamera]);

  // ─── Early states ─────────────────────────────────────────────────────────

  if (loading && assets.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.iOSBlue} />
      </View>
    );
  }

  if (permission !== 'granted') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No Access</Text>
        <Text style={styles.emptyDesc}>Storage permission is required to view photos.</Text>
      </View>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        {/* Album picker button */}
        <TouchableOpacity
          style={styles.albumButton}
          onPress={() => setShowDropdown(v => !v)}
        >
          <Text style={styles.albumButtonText}>{activeAlbum.title}</Text>
          <Text style={styles.albumChevron}>{showDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Done button */}
        {selected.size > 0 && (
          <TouchableOpacity
            style={[styles.doneButton, uploading && styles.doneButtonDisabled]}
            onPress={handleDone}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.doneText}>
                Done{maxSelection ? ` (${selected.size}/${maxSelection})` : ` (${selected.size})`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Album dropdown (floats over the grid) ── */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView bounces={false} style={styles.dropdownScroll}>
            {/* "All Photos" row */}
            <TouchableOpacity
              style={[styles.albumRow, activeAlbum.id === ALL_PHOTOS.id && styles.albumRowActive]}
              onPress={() => selectAlbum(ALL_PHOTOS)}
            >
              <Text style={styles.albumRowTitle}>All Photos</Text>
              {activeAlbum.id === ALL_PHOTOS.id && (
                <Text style={styles.albumRowCheck}>✓</Text>
              )}
            </TouchableOpacity>

            {albums.map(album => (
              <TouchableOpacity
                key={album.id}
                style={[styles.albumRow, activeAlbum.id === album.id && styles.albumRowActive]}
                onPress={() => selectAlbum(album)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.albumRowTitle}>{album.title}</Text>
                  {album.assetCount > 0 && (
                    <Text style={styles.albumRowCount}>{album.assetCount} photos</Text>
                  )}
                </View>
                {activeAlbum.id === album.id && (
                  <Text style={styles.albumRowCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Photo grid ──
          Camera cell (QA #52) is always the first item, same as
          CustomGalleryScreen.tsx's listData — so it's still reachable even
          when the active album has no photos, instead of that case fully
          replacing the grid with a dead-end "No Photos" screen. */}
      <FlatList
        data={['camera' as const, ...assets]}
        keyExtractor={item => item === 'camera' ? '__camera__' : item.id}
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          assets.length === 0 && !loading
            ? <Text style={[styles.emptyDesc, styles.emptyDescInGrid]}>This album is empty.</Text>
            : null
        }
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator style={styles.loadingMore} color={Colors.iOSBlue} />
            : null
        }
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  emptyDescInGrid: {
    paddingVertical: 24,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  albumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#222',
    borderRadius: 20,
  },
  albumButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  albumChevron: {
    color: '#aaa',
    fontSize: 11,
  },
  doneButton: {
    backgroundColor: Colors.iOSBlue,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Album dropdown — floats over the grid
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#1c1c1e',
    maxHeight: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  dropdownScroll: {
    flexGrow: 0,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  albumRowActive: {
    backgroundColor: '#2c2c2e',
  },
  albumRowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  albumRowCount: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  albumRowCheck: {
    color: Colors.iOSBlue,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Grid
  grid: {
    paddingTop: GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  // Camera cell — same icon/label pattern as CustomGalleryScreen.tsx's own
  // cameraCell, sized to this screen's own TILE_SIZE grid instead of that
  // screen's CELL_SIZE.
  cameraTile: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cameraLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 122, 255, 0.35)',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: {
    backgroundColor: Colors.iOSBlue,
    borderColor: Colors.iOSBlue,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingMore: {
    paddingVertical: 16,
  },
});

import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Colors } from '../constants/colors';

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

type Props = {
  onDone?: (assets: Asset[]) => void;
  maxSelection?: number;
};

export default function GalleryScreen({ onDone, maxSelection }: Props) {
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
  const endCursorRef = useRef<string | undefined>(undefined);

  // ─── Permission + initial load ────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        setPermission('denied');
        setLoading(false);
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
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
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (maxSelection && next.size >= maxSelection) return prev;
        next.add(id);
      }
      return next;
    });
  }, [maxSelection]);

  const handleDone = useCallback(() => {
    const selectedAssets = assets.filter(a => selected.has(a.id));
    onDone?.(selectedAssets);
  }, [assets, selected, onDone]);

  // ─── Render tile ──────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item, index }: { item: Asset; index: number }) => {
    const isSelected = selected.has(item.id);
    const selectionIndex = isSelected ? [...selected].indexOf(item.id) + 1 : null;
    const col = index % NUM_COLUMNS;
    const marginLeft  = col === 0 ? GAP : GAP / 2;
    const marginRight = col === NUM_COLUMNS - 1 ? GAP : GAP / 2;

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
  }, [selected, toggleSelect]);

  // ─── Early states ─────────────────────────────────────────────────────────

  if (loading && assets.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneText}>
              Done{maxSelection ? ` (${selected.size}/${maxSelection})` : ` (${selected.size})`}
            </Text>
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

      {/* ── Photo grid ── */}
      {assets.length === 0 && !loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No Photos</Text>
          <Text style={styles.emptyDesc}>This album is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.grid}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator style={styles.loadingMore} color="#007AFF" />
              : null
          }
        />
      )}
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
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
    shadowColor: '#000',
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
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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

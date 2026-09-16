import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  LocationData,
  PermissionResult,
  requestCameraPermission,
  requestLocationWithCoordinates,
  requestMicrophonePermission,
  requestPushNotificationPermission,
  requestStoragePermission,
} from '../service/permissionService';
import { FontSize } from '../src/theme/fonts'

const STATUS_COLOR: Record<PermissionResult, string> = {
  granted: '#34C759',
  denied: '#FF3B30',
  blocked: '#FF9500',
};

type PermissionState = {
  location: LocationData | null;
  notification: PermissionResult | null;
  storage: PermissionResult | null;
  microphone: PermissionResult | null;
  camera: PermissionResult | null;
};

type LoadingState = {
  location: boolean;
  notification: boolean;
  storage: boolean;
  microphone: boolean;
  camera: boolean;
};

export default function PermissionDemoScreen() {
  const [permissions, setPermissions] = useState<PermissionState>({
    location: null,
    notification: null,
    storage: null,
    microphone: null,
    camera: null,
  });

  const [loading, setLoading] = useState<LoadingState>({
    location: false,
    notification: false,
    storage: false,
    microphone: false,
    camera: false,
  });

  const setLoad = (key: keyof LoadingState, value: boolean) =>
    setLoading(prev => ({ ...prev, [key]: value }));

  const handleLocation = async () => {
    setLoad('location', true);
    const result = await requestLocationWithCoordinates();
    setPermissions(prev => ({ ...prev, location: result }));
    setLoad('location', false);
  };

  const handleNotification = async () => {
    setLoad('notification', true);
    const result = await requestPushNotificationPermission();
    setPermissions(prev => ({ ...prev, notification: result }));
    setLoad('notification', false);
  };

  const handleStorage = async () => {
    setLoad('storage', true);
    const result = await requestStoragePermission();
    setPermissions(prev => ({ ...prev, storage: result }));
    setLoad('storage', false);
  };

  const handleMicrophone = async () => {
    setLoad('microphone', true);
    const result = await requestMicrophonePermission();
    setPermissions(prev => ({ ...prev, microphone: result }));
    setLoad('microphone', false);
  };

  const handleCamera = async () => {
    setLoad('camera', true);
    const result = await requestCameraPermission();
    setPermissions(prev => ({ ...prev, camera: result }));
    setLoad('camera', false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>App Permissions</Text>
      <Text style={styles.subheading}>Tap Allow to request each permission</Text>

      <PermissionRow
        label="Location"
        description="Get your current latitude & longitude"
        loading={loading.location}
        onPress={handleLocation}
      >
        {permissions.location && (
          <StatusCard status={permissions.location.status}>
            {permissions.location.latitude !== undefined ? (
              <>
                <InfoRow label="Latitude" value={permissions.location.latitude.toFixed(6)} />
                <InfoRow label="Longitude" value={permissions.location.longitude!.toFixed(6)} />
                {permissions.location.accuracy !== undefined && (
                  <InfoRow
                    label="Accuracy"
                    value={`${permissions.location.accuracy.toFixed(1)} m`}
                  />
                )}
              </>
            ) : (
              <DeniedMessage status={permissions.location.status} />
            )}
          </StatusCard>
        )}
      </PermissionRow>

      <PermissionRow
        label="Push Notification"
        description="Allow the app to send you alerts"
        loading={loading.notification}
        onPress={handleNotification}
      >
        {permissions.notification && (
          <StatusCard status={permissions.notification}>
            <DeniedMessage status={permissions.notification} showOnGranted />
          </StatusCard>
        )}
      </PermissionRow>

      <PermissionRow
        label="Storage"
        description="Access photos and media on your device"
        loading={loading.storage}
        onPress={handleStorage}
      >
        {permissions.storage && (
          <StatusCard status={permissions.storage}>
            <DeniedMessage status={permissions.storage} showOnGranted />
          </StatusCard>
        )}
      </PermissionRow>

      <PermissionRow
        label="Microphone"
        description="Record audio for voice messages"
        loading={loading.microphone}
        onPress={handleMicrophone}
      >
        {permissions.microphone && (
          <StatusCard status={permissions.microphone}>
            <DeniedMessage status={permissions.microphone} showOnGranted />
          </StatusCard>
        )}
      </PermissionRow>

      <PermissionRow
        label="Camera"
        description="Take photos and videos using the device camera"
        loading={loading.camera}
        onPress={handleCamera}
      >
        {permissions.camera && (
          <StatusCard status={permissions.camera}>
            <DeniedMessage status={permissions.camera} showOnGranted />
          </StatusCard>
        )}
      </PermissionRow>
    </ScrollView>
  );
}

// ─── Reusable components ─────────────────────────────────────────────────────

function PermissionRow({
  label,
  description,
  loading,
  onPress,
  children,
}: {
  label: string;
  description: string;
  loading: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.permLabel}>{label}</Text>
          <Text style={styles.permDesc}>{description}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={onPress} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Allow</Text>
          )}
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function StatusCard({
  status,
  children,
}: {
  status: PermissionResult;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { borderColor: STATUS_COLOR[status] }]}>
      <Text style={[styles.statusBadge, { color: STATUS_COLOR[status] }]}>
        {status.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      <View style={styles.divider} />
    </>
  );
}

function DeniedMessage({
  status,
  showOnGranted = false,
}: {
  status: PermissionResult;
  showOnGranted?: boolean;
}) {
  if (status === 'granted') {
    return showOnGranted ? (
      <Text style={styles.grantedText}>Access has been granted.</Text>
    ) : null;
  }
  return (
    <Text style={styles.deniedText}>
      {status === 'blocked'
        ? 'Permission blocked. Tap Open Settings from the alert.'
        : 'Permission was denied.'}
    </Text>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f7f7f7',
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 16,
  },
  heading: {
    fontSize: FontSize.font22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subheading: {
    fontSize: FontSize.font13,
    color: '#888',
    marginTop: -8,
    marginBottom: 4,
  },
  permissionRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permLabel: {
    fontSize: FontSize.font15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  permDesc: {
    fontSize: FontSize.font12,
    color: '#888',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSize.font14,
    fontWeight: '600',
  },
  card: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  statusBadge: {
    fontSize: FontSize.font12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: FontSize.font13,
    color: '#888',
  },
  infoValue: {
    fontSize: FontSize.font13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  deniedText: {
    fontSize: FontSize.font13,
    color: '#666',
  },
  grantedText: {
    fontSize: FontSize.font13,
    color: '#34C759',
  },
});

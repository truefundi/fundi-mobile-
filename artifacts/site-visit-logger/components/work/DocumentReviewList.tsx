import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import type { WorkProfile } from '@/constants/work';
import { useWork, type DocumentFile } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

type ReviewDocument = NonNullable<WorkProfile['documents']>[number];

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Waiting for review',
  REVIEWING: 'Under review',
  ACCEPTED: 'Accepted',
  DENIED: 'Needs a new file',
};

async function withWebSize(file: DocumentFile): Promise<DocumentFile> {
  if (Platform.OS !== 'web' || file.size !== undefined) return file;
  try {
    const blob = await (await fetch(file.uri)).blob();
    return {
      ...file,
      size: blob.size,
      mimeType: inferUploadMimeType(file.name ?? file.uri, file.mimeType ?? blob.type),
    };
  } catch {
    return file;
  }
}

async function pickFile(source: 'camera' | 'files'): Promise<DocumentFile | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access to take a photo.');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.78,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return null;
    return {
      uri: asset.uri,
      name: asset.fileName ?? undefined,
      size: asset.fileSize ?? undefined,
      mimeType: inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ?? 'image/jpeg',
    };
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.uri) return null;
  return withWebSize({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? undefined,
    mimeType: inferUploadMimeType(asset.name || asset.uri, asset.mimeType),
  });
}

function fileProblem(file: DocumentFile): string | null {
  const mimeType = inferUploadMimeType(file.name ?? file.uri, file.mimeType);
  if (!mimeType || (!mimeType.startsWith('image/') && mimeType !== 'application/pdf')) {
    return 'Choose a photo or a PDF.';
  }
  if (file.size !== undefined && file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `The file must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`;
  }
  return null;
}

function DocumentRow({ document }: { document: ReviewDocument }) {
  const colors = useColors();
  const { resubmitDocument } = useWork();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const denied = document.status === 'DENIED';
  const tone = denied ? colors.destructive : document.status === 'ACCEPTED' ? colors.success : colors.warning;
  const icon = denied ? 'alert-circle' : document.status === 'ACCEPTED' ? 'check-circle' : 'clock';

  const send = async (source: 'camera' | 'files') => {
    setError(null);
    try {
      const file = await pickFile(source);
      if (!file) return;
      const problem = fileProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
      setBusy(true);
      await resubmitDocument(document.id, file);
      setJustSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be sent. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const chooseSource = () => {
    if (busy) return;
    if (Platform.OS === 'web') {
      void send('files');
      return;
    }
    Alert.alert(`Replace ${document.title}`, 'Send a clear photo or PDF.', [
      { text: 'Take photo', onPress: () => void send('camera') },
      { text: 'Choose file', onPress: () => void send('files') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View
      testID={`document-${document.id}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: denied ? colors.destructive : colors.border,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <Feather name={icon} size={18} color={tone} />
        <View style={styles.rowText}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={[styles.status, { color: tone }]}>{STATUS_LABEL[document.status] ?? document.status}</Text>
        </View>
      </View>

      {denied && document.reviewNote ? (
        <View style={[styles.note, { backgroundColor: colors.destructive + '12' }]}>
          <Text style={[styles.noteLabel, { color: colors.destructive }]}>Reviewer note</Text>
          <Text style={[styles.noteText, { color: colors.foreground }]}>{document.reviewNote}</Text>
        </View>
      ) : null}

      {!denied && justSent ? (
        <Text style={[styles.hint, { color: colors.success }]}>New file sent. It is back in the review queue.</Text>
      ) : null}

      {denied ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Replace ${document.title}`}
          accessibilityState={{ busy, disabled: busy }}
          testID={`replace-document-${document.id}`}
          disabled={busy}
          onPress={chooseSource}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: busy ? 0.7 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="upload" size={15} color={colors.primaryForeground} />
          )}
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {busy ? 'Sending…' : 'Replace and resubmit'}
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={[styles.hint, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

/**
 * The technician's submitted documents with their review status. A denied
 * document shows its reviewer note and can be replaced on its own; the others
 * stay as they are. The submitted order is kept so rows never swap places.
 */
export function DocumentReviewList({ documents }: { documents: ReviewDocument[] }) {
  const colors = useColors();
  if (!documents.length) return null;
  return (
    <View style={styles.list}>
      <Text style={[styles.heading, { color: colors.foreground }]}>Documents</Text>
      {documents.map((document) => (
        <DocumentRow key={document.id} document={document} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', gap: 10 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, gap: 2 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  status: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  note: { borderRadius: 8, padding: 10, gap: 3 },
  noteLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noteText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 11,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  hint: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
});

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useDisputes, type DisputePartyRole, type DisputeRecord } from '@/context/DisputeContext';
import * as ImagePicker from 'expo-image-picker';

interface ReportDisputeModalProps {
  visible: boolean;
  onClose: () => void;
  jobId: string;
  jobReference?: string;
  service: string;
  role: DisputePartyRole;
  submitterName: string;
  submitterPhone: string;
  clientName: string;
  clientPhone: string;
  technicianName: string;
  technicianPhone: string;
  agreedPrice?: number;
  existingDispute?: DisputeRecord;
  onDisputeSubmitted?: () => void;
}

const CLIENT_REASONS = [
  'Disagreement During Price Negotiation',
  'Bad Service / Poor Workmanship',
  'Overcharging / Price Disagreement',
  'Incomplete Work / Left Early',
  'Technician No-Show or Excessive Delay',
  'Property Damage / Safety Concern',
  'Unprofessional Conduct',
  'Other Issue',
];

const TECHNICIAN_REASONS = [
  'Disagreement During Price Negotiation',
  'Client Refused Agreed Payment',
  'Scope Creep / Demands Without Extra Pay',
  'Unsafe Work Environment',
  'Client Unresponsive / Access Denied',
  'False Damage Claim',
  'Unprofessional Conduct by Client',
  'Other Issue',
];

const OUTCOME_OPTIONS = [
  'Full Refund / Cancellation',
  'Partial Refund / Fee Adjustment',
  'Return to Fix / Complete Free of Charge',
  'Enforce Agreed Payment',
  'Admin Mediation & Resolution',
];

export function ReportDisputeModal({
  visible,
  onClose,
  jobId,
  jobReference,
  service,
  role,
  submitterName,
  submitterPhone,
  clientName,
  clientPhone,
  technicianName,
  technicianPhone,
  agreedPrice,
  existingDispute,
  onDisputeSubmitted,
}: ReportDisputeModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { submitDisputeStatement } = useDisputes();

  const reasons = role === 'client' ? CLIENT_REASONS : TECHNICIAN_REASONS;

  const [selectedReason, setSelectedReason] = useState(reasons[0]);
  const [description, setDescription] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState(OUTCOME_OPTIONS[role === 'client' ? 1 : 3]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherStatement = existingDispute?.statements.find((s) => s.submittedBy !== role);

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Photo Error', 'Could not select photo. Try again.');
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please provide a clear description of the disagreement or problem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitDisputeStatement({
        jobId,
        jobReference,
        service,
        role,
        submitterName,
        submitterPhone,
        clientName,
        clientPhone,
        technicianName,
        technicianPhone,
        agreedPrice,
        reason: selectedReason,
        description: description.trim(),
        desiredOutcome,
        evidencePhotoUri: photoUri || undefined,
      });

      Alert.alert(
        'Disagreement Report Submitted',
        'Your statement has been submitted to the Fundi Support team. An administrator on the web dashboard will review submissions from both parties and mediate.',
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              onDisputeSubmitted?.();
            },
          },
        ]
      );
    } catch {
      Alert.alert('Submission Error', 'Failed to submit dispute statement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="shield" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {otherStatement ? 'Respond to Disagreement' : 'Report Disagreement'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {service} · {role === 'client' ? 'Client submission' : 'Technician submission'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* If other party already submitted */}
            {otherStatement ? (
              <View
                style={[
                  styles.otherNotice,
                  {
                    backgroundColor: isDark ? '#000000' : colors.secondary,
                    borderColor: colors.primary,
                    borderWidth: isDark ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.noticeHeader}>
                  <Feather name="alert-circle" size={15} color={colors.primary} />
                  <Text style={[styles.noticeTitle, { color: colors.primary }]}>
                    {otherStatement.submittedBy === 'client' ? 'Client' : 'Technician'} Statement Filed
                  </Text>
                </View>
                <Text style={[styles.noticeReason, { color: colors.foreground }]}>
                  &ldquo;{otherStatement.reason}&rdquo;
                </Text>
                <Text style={[styles.noticeDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                  {otherStatement.description}
                </Text>
              </View>
            ) : null}

            {/* Submitter info reminder */}
            <View style={[styles.infoBanner, { backgroundColor: isDark ? '#000000' : colors.muted, borderColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoBannerText, { color: colors.foreground }]}>
                Filing as <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>{role === 'client' ? 'Client / Customer' : 'Technician'}</Text> ({submitterName})
              </Text>
            </View>

            {/* Reason selector */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              What went wrong? Select reason:
            </Text>
            <View style={styles.chipsContainer}>
              {reasons.map((r) => {
                const active = selectedReason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setSelectedReason(r)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? (isDark ? '#000000' : colors.secondary)
                          : (isDark ? '#000000' : colors.muted),
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active ? colors.primary : colors.foreground,
                          fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                        },
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Description Input */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Explain the problem in detail:
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              placeholder={
                role === 'client'
                  ? 'Describe clearly what happened with the technician, what work was done, and where the disagreement lies…'
                  : 'Describe clearly what happened with the client, payment agreed, work performed, and the issue faced…'
              }
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#000000' : colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            {/* Desired outcome */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              What resolution are you requesting?
            </Text>
            <View style={styles.chipsContainer}>
              {OUTCOME_OPTIONS.map((opt) => {
                const active = desiredOutcome === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setDesiredOutcome(opt)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? (isDark ? '#000000' : colors.secondary)
                          : (isDark ? '#000000' : colors.muted),
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active ? colors.primary : colors.foreground,
                          fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Evidence attachment */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Attach photo evidence (optional):
            </Text>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <Pressable
                  onPress={() => setPhotoUri(null)}
                  style={[styles.removePhotoBtn, { backgroundColor: colors.destructive }]}
                >
                  <Feather name="x" size={14} color="#ffffff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handlePickPhoto}
                style={[
                  styles.uploadBox,
                  {
                    backgroundColor: isDark ? '#000000' : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather name="camera" size={20} color={colors.primary} />
                <Text style={[styles.uploadText, { color: colors.primary }]}>Upload picture or screenshot</Text>
              </Pressable>
            )}

            <View style={[styles.noteBox, { backgroundColor: isDark ? '#000000' : colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                A support administrator on the web dashboard will review submissions from both parties, examine job records, and mediate a fair resolution.
              </Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? '#000000' : 'transparent',
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isDark ? '#000000' : colors.primary,
                  borderColor: colors.primary,
                  borderWidth: 1.5,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={isDark ? colors.primary : '#ffffff'} size="small" />
              ) : (
                <>
                  <Feather name="send" size={15} color={isDark ? colors.primary : '#ffffff'} />
                  <Text style={[styles.submitBtnText, { color: isDark ? colors.primary : '#ffffff' }]}>
                    Submit Disagreement
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 18,
  },
  otherNotice: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  noticeReason: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 2,
  },
  noticeDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBannerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  uploadText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  photoPreviewWrap: {
    position: 'relative',
    marginBottom: 16,
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  noteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  submitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
});


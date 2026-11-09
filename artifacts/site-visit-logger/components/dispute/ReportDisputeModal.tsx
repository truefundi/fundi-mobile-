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
  Platform,
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
  'Poor Workmanship / Quality Issue',
  'Overcharging / Price Disagreement',
  'Incomplete Work / Left Early',
  'Technician No-Show or Excessive Delay',
  'Property Damage / Safety Concern',
  'Unprofessional Conduct',
  'Other Issue',
];

const TECHNICIAN_REASONS = [
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      Alert.alert('Required Field', 'Please provide a clear description of the dispute.');
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
        'Dispute Reported',
        'Your statement has been submitted to the Truefundi Admin Dispute Center. An administrator will review both statements and mediate resolution.',
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
              <View style={[styles.badgeIcon, { backgroundColor: colors.destructive + '15' }]}>
                <Feather name="shield" size={18} color={colors.destructive} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {otherStatement ? 'Respond to Dispute' : 'Report Dispute'}
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
                    backgroundColor: colors.secondary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.noticeHeader}>
                  <Feather name="alert-circle" size={15} color={colors.primary} />
                  <Text style={[styles.noticeTitle, { color: colors.primary }]}>
                    {otherStatement.submittedBy === 'client' ? 'Client' : 'Technician'} Claim
                  </Text>
                </View>
                <Text style={[styles.noticeReason, { color: colors.foreground }]}>
                  Reason: {otherStatement.reason}
                </Text>
                <Text style={[styles.noticeDetails, { color: colors.mutedForeground }]}>
                  "{otherStatement.description}"
                </Text>
                <Text style={[styles.noticeOutcome, { color: colors.foreground }]}>
                  Desired: {otherStatement.desiredOutcome}
                </Text>
              </View>
            ) : null}

            {/* Reason selection */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>What is the primary issue?</Text>
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
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active ? colors.primaryForeground : colors.foreground,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Statement description */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Describe what happened in detail:
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="State what went wrong, timelines, agreed amounts, or what the other party failed to deliver..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            {/* Desired outcome */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Desired resolution:</Text>
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
                        backgroundColor: active ? (isDark ? colors.secondary : colors.secondary) : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active ? colors.primary : colors.foreground,
                          fontWeight: active ? '700' : '500',
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
                style={[styles.uploadBox, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Feather name="camera" size={20} color={colors.primary} />
                <Text style={[styles.uploadText, { color: colors.primary }]}>Upload picture or screenshot</Text>
              </Pressable>
            )}

            <View style={[styles.noteBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                The Truefundi Admin mediator will review submissions from both parties, examine job logs and photos, and reach a fair settlement.
              </Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable onPress={onClose} style={[styles.cancelBtn, { borderColor: colors.border }]}>
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Close</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.destructive,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#ffffff" />
                  <Text style={styles.submitBtnText}>Submit to Admin</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  otherNotice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  noticeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  noticeReason: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 4,
  },
  noticeDetails: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  noticeOutcome: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginBottom: 12,
  },
  uploadText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  photoPreviewWrap: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  submitBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
});


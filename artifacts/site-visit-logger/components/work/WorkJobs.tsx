import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { isClosed, isTerminated, STATUS_LABEL, type Job } from '@/constants/jobs';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { canOpenMapNavigation, openMapNavigation } from '@/lib/location';

type Tab = 'In Progress' | 'Completed' | 'Cancelled';

export function WorkJobs() {
  const colors = useColors();
  const router = useRouter();
  const { mine, done, cancelled, earnings, cancelJob, completeJob } = useWork();
  const [tab, setTab] = useState<Tab>('In Progress');

  // Selected job for the Details Modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Cancellation sub-flow
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Completion / End Service sub-flow
  const [showCompleteFlow, setShowCompleteFlow] = useState(false);
  const [completionPhotoUri, setCompletionPhotoUri] = useState<string | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const visibleJobs: Job[] = tab === 'In Progress' ? mine : tab === 'Completed' ? done : cancelled;

  const handleOpenJobDetails = (job: Job) => {
    setSelectedJob(job);
    setShowCancelPrompt(false);
    setShowCompleteFlow(false);
    setCancelReason('');
    setCompletionPhotoUri(null);
  };

  const handlePickCompletionPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Camera access is required to photograph completed work.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          setCompletionPhotoUri(result.assets[0].uri);
        }
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          setCompletionPhotoUri(result.assets[0].uri);
        }
      }
    } catch (e) {
      console.warn('Could not pick photo:', e);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedJob) return;
    const reason = cancelReason.trim() || 'Misunderstanding during service execution.';
    setCancelLoading(true);
    try {
      await cancelJob(selectedJob.id, reason);
      setSelectedJob(null);
      setShowCancelPrompt(false);
      setCancelReason('');
      Alert.alert('Job Cancelled', 'The in-progress job was cancelled and the client has been notified.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel the job.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!selectedJob) return;
    setCompleteLoading(true);
    try {
      await completeJob(selectedJob.id, completionPhotoUri ?? undefined);
      setSelectedJob(null);
      setShowCompleteFlow(false);
      setCompletionPhotoUri(null);
      Alert.alert('Service Completed', 'The job has been marked as finished and your client has been notified with the completed work proof.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not complete the job.');
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCallClient = (phone?: string) => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone}`);
  };

  const handleChatClient = (threadId?: string) => {
    setSelectedJob(null);
    if (threadId) {
      router.push({ pathname: '/chat', params: { threadId } });
    } else {
      router.push('/chat');
    }
  };

  return (
    <View style={styles.container}>
      {/* Earnings and job counter summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.secondaryForeground }]}>Total Earnings</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            RWF {earnings.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryStats}>
          <Text style={[styles.statsText, { color: colors.secondaryForeground }]}>
            {mine.length} active · {done.length} completed
          </Text>
        </View>
      </View>

      {/* Tabs: In Progress, Completed, Cancelled */}
      <View style={[styles.tabsRow, { backgroundColor: colors.muted }]}>
        {(['In Progress', 'Completed', 'Cancelled'] as Tab[]).map((t) => {
          const selected = t === tab;
          const count = t === 'In Progress' ? mine.length : t === 'Completed' ? done.length : cancelled.length;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabButton, selected && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: selected ? colors.foreground : colors.mutedForeground,
                    fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                {t} {count > 0 ? `(${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Job list */}
      {visibleJobs.length === 0 ? (
        <EmptyState
          icon={tab === 'In Progress' ? 'briefcase' : tab === 'Completed' ? 'check-circle' : 'x-circle'}
          title={
            tab === 'In Progress'
              ? 'No jobs in progress'
              : tab === 'Completed'
              ? 'No completed jobs yet'
              : 'No cancelled jobs'
          }
          text={
            tab === 'In Progress'
              ? 'When you start a job from your client service chat, it will appear here.'
              : tab === 'Completed'
              ? 'Jobs you complete will be kept here along with your earnings.'
              : 'Jobs that were terminated or cancelled will appear here.'
          }
        />
      ) : (
        <View style={styles.list}>
          {visibleJobs.map((job) => {
            const inProgress = !isClosed(job.status) && !isTerminated(job.status);
            const terminated = isTerminated(job.status);
            const agreedAmount = job.agreedPrice || job.visitFee;

            return (
              <Pressable
                key={job.id}
                onPress={() => handleOpenJobDetails(job)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: inProgress
                      ? colors.primary
                      : terminated
                      ? colors.destructive + '40'
                      : colors.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                {/* Header row: Job Title & Status */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.jobServiceTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {job.service}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: inProgress
                          ? colors.primary + '20'
                          : terminated
                          ? colors.destructive + '15'
                          : colors.success + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: inProgress
                            ? colors.primary
                            : terminated
                            ? colors.destructive
                            : colors.success,
                        },
                      ]}
                    >
                      {inProgress ? 'In Progress' : STATUS_LABEL[job.status]}
                    </Text>
                  </View>
                </View>

                {/* Agreed Amount Box */}
                <View style={[styles.agreedAmountRow, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.agreedAmountLabel, { color: colors.secondaryForeground }]}>
                    Agreed Fee:
                  </Text>
                  <Text style={[styles.agreedAmountValue, { color: colors.primary }]}>
                    RWF {agreedAmount.toLocaleString()}
                  </Text>
                </View>

                {/* Job Description */}
                <Text style={[styles.jobProblem, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {job.problem}
                </Text>

                {/* Client & Location */}
                <View style={styles.clientAndLocationRow}>
                  <View style={styles.infoRow}>
                    <Feather name="user" size={13} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.foreground, fontWeight: '600' }]} numberOfLines={1}>
                      {job.clientName || 'Client'}
                    </Text>
                    {job.clientPhone ? (
                      <Text style={[styles.infoSubText, { color: colors.mutedForeground }]}>
                        · {job.clientPhone}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {job.locationLabel}
                    </Text>
                  </View>
                </View>

                {/* Card footer CTA */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
                    Tap to view details &amp; actions →
                  </Text>
                  {job.completedPhotoUri && (
                    <View style={styles.photoAttachedBadge}>
                      <Ionicons name="image-outline" size={13} color={colors.success} />
                      <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>Proof attached</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ─── JOB DETAILS MODAL ────────────────────────────────────────────── */}
      {selectedJob && (
        <Modal
          visible={selectedJob !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedJob(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedJob.service}</Text>
                  <Text style={[styles.modalRef, { color: colors.mutedForeground }]}>Ref: {selectedJob.reference}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setSelectedJob(null)}
                  style={styles.closeBtn}
                >
                  <Feather name="x" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                {/* Status & Agreed Price Highlight */}
                <View style={[styles.detailHighlightCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailHighlightLabel, { color: colors.secondaryForeground }]}>
                      Agreed Service Fee
                    </Text>
                    <Text style={[styles.detailHighlightPrice, { color: colors.primary }]}>
                      RWF {(selectedJob.agreedPrice || selectedJob.visitFee).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatusBadge,
                      {
                        backgroundColor:
                          !isClosed(selectedJob.status) && !isTerminated(selectedJob.status)
                            ? colors.primary + '20'
                            : isTerminated(selectedJob.status)
                            ? colors.destructive + '15'
                            : colors.success + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalStatusBadgeText,
                        {
                          color:
                            !isClosed(selectedJob.status) && !isTerminated(selectedJob.status)
                              ? colors.primary
                              : isTerminated(selectedJob.status)
                              ? colors.destructive
                              : colors.success,
                        },
                      ]}
                    >
                      {!isClosed(selectedJob.status) && !isTerminated(selectedJob.status)
                        ? 'In Progress'
                        : STATUS_LABEL[selectedJob.status]}
                    </Text>
                  </View>
                </View>

                {/* Client Information Card */}
                <View style={[styles.sectionBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Client Information</Text>
                  <View style={styles.clientDetailRow}>
                    <View style={[styles.clientAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.clientAvatarText}>
                        {(selectedJob.clientName || 'C')[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clientName, { color: colors.foreground }]}>
                        {selectedJob.clientName || 'Client'}
                      </Text>
                      <Text style={[styles.clientPhone, { color: colors.mutedForeground }]}>
                        {selectedJob.clientPhone || 'Phone not provided'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.clientActionsRow}>
                    {selectedJob.clientPhone ? (
                      <Pressable
                        onPress={() => handleCallClient(selectedJob.clientPhone)}
                        style={[styles.clientActionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      >
                        <Feather name="phone" size={14} color={colors.primary} />
                        <Text style={[styles.clientActionBtnText, { color: colors.primary }]}>Call Client</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleChatClient(selectedJob.chatThreadId)}
                      style={[styles.clientActionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    >
                      <Ionicons name="chatbubbles-outline" size={14} color={colors.primary} />
                      <Text style={[styles.clientActionBtnText, { color: colors.primary }]}>Open Chat</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Location Card */}
                <View style={[styles.sectionBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Service Location</Text>
                  <View style={styles.locationDetailRow}>
                    <Feather name="map-pin" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.locationText, { color: colors.foreground }]}>
                      {selectedJob.locationLabel}
                    </Text>
                  </View>
                  {canOpenMapNavigation(selectedJob) && (
                    <Pressable
                      onPress={() => void openMapNavigation(selectedJob)}
                      style={[styles.navActionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    >
                      <Feather name="navigation" size={14} color={colors.primary} />
                      <Text style={[styles.navActionBtnText, { color: colors.primary }]}>Navigate to Address</Text>
                    </Pressable>
                  )}
                </View>

                {/* Problem Description */}
                <View style={[styles.sectionBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Problem Description</Text>
                  <Text style={[styles.problemDetailText, { color: colors.foreground }]}>
                    {selectedJob.problem}
                  </Text>
                  {selectedJob.photoUri && (
                    <Pressable onPress={() => setPreviewImage(selectedJob.photoUri ?? null)} style={styles.mediaThumbnailWrap}>
                      <Image source={{ uri: selectedJob.photoUri }} style={styles.mediaThumbnail} contentFit="cover" />
                      <Text style={[styles.mediaThumbLabel, { color: colors.primary }]}>View client photo</Text>
                    </Pressable>
                  )}
                </View>

                {/* Proof of Completed Work (if already completed) */}
                {selectedJob.completedPhotoUri && (
                  <View style={[styles.sectionBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.sectionHeading, { color: colors.success }]}>Completed Work Proof</Text>
                    <Pressable onPress={() => setPreviewImage(selectedJob.completedPhotoUri ?? null)} style={styles.mediaThumbnailWrap}>
                      <Image source={{ uri: selectedJob.completedPhotoUri }} style={styles.completedWorkImage} contentFit="cover" />
                      <Text style={[styles.mediaThumbLabel, { color: colors.success }]}>Tap to expand photo</Text>
                    </Pressable>
                  </View>
                )}

                {/* Cancellation details (if cancelled) */}
                {selectedJob.cancellationReason && (
                  <View style={[styles.sectionBlock, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30' }]}>
                    <Text style={[styles.sectionHeading, { color: colors.destructive }]}>Cancellation Reason</Text>
                    <Text style={[styles.problemDetailText, { color: colors.destructive }]}>
                      {selectedJob.cancellationReason}
                    </Text>
                  </View>
                )}

                {/* Actions: Cancel or End Service (Only for In-Progress jobs) */}
                {!isClosed(selectedJob.status) && !isTerminated(selectedJob.status) && (
                  <View style={styles.actionsContainer}>
                    {!showCancelPrompt && !showCompleteFlow && (
                      <View style={styles.twoActionRow}>
                        <Button
                          label="Cancel Job"
                          variant="outline"
                          icon="close-circle-outline"
                          onPress={() => setShowCancelPrompt(true)}
                          style={{ flex: 1, borderColor: colors.destructive }}
                          textColor={colors.destructive}
                        />
                        <Button
                          label="End Service"
                          icon="checkmark-done-circle-outline"
                          onPress={() => setShowCompleteFlow(true)}
                          style={{ flex: 1.3 }}
                        />
                      </View>
                    )}

                    {/* CANCEL SUB-FLOW */}
                    {showCancelPrompt && (
                      <View style={[styles.flowBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
                        <Text style={[styles.flowTitle, { color: colors.destructive }]}>
                          Cancel in-progress job?
                        </Text>
                        <Text style={[styles.flowSub, { color: colors.mutedForeground }]}>
                          If there is a misunderstanding or scope mismatch, provide the reason below. The client will be notified immediately.
                        </Text>
                        <TextInput
                          placeholder="e.g. Client requested out-of-scope work / misunderstanding on parts"
                          placeholderTextColor={colors.mutedForeground}
                          value={cancelReason}
                          onChangeText={setCancelReason}
                          multiline
                          style={[styles.inputBox, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                        />
                        <View style={styles.flowActionRow}>
                          <Button
                            label="Keep Job"
                            variant="outline"
                            size="small"
                            onPress={() => setShowCancelPrompt(false)}
                            disabled={cancelLoading}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label={cancelLoading ? 'Cancelling…' : 'Confirm Cancel'}
                            variant="danger"
                            size="small"
                            onPress={handleConfirmCancel}
                            disabled={cancelLoading}
                            style={{ flex: 1.3 }}
                          />
                        </View>
                      </View>
                    )}

                    {/* END SERVICE / COMPLETE SUB-FLOW */}
                    {showCompleteFlow && (
                      <View style={[styles.flowBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                        <Text style={[styles.flowTitle, { color: colors.foreground }]}>
                          End &amp; Complete Service
                        </Text>
                        <Text style={[styles.flowSub, { color: colors.mutedForeground }]}>
                          Upload a picture of the finished work so the client can inspect it.
                        </Text>

                        {/* Photo preview or pick buttons */}
                        {completionPhotoUri ? (
                          <View style={styles.photoPreviewCard}>
                            <Image source={{ uri: completionPhotoUri }} style={styles.completionPreviewImg} contentFit="cover" />
                            <Pressable
                              onPress={() => setCompletionPhotoUri(null)}
                              style={[styles.removePhotoBtn, { backgroundColor: colors.destructive }]}
                            >
                              <Feather name="x" size={16} color="#fff" />
                            </Pressable>
                          </View>
                        ) : (
                          <View style={styles.photoPickersRow}>
                            <Pressable
                              onPress={() => void handlePickCompletionPhoto('camera')}
                              style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                              <Ionicons name="camera-outline" size={20} color={colors.primary} />
                              <Text style={[styles.pickBtnText, { color: colors.foreground }]}>Take Photo</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void handlePickCompletionPhoto('library')}
                              style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                              <Ionicons name="images-outline" size={20} color={colors.primary} />
                              <Text style={[styles.pickBtnText, { color: colors.foreground }]}>Choose Photo</Text>
                            </Pressable>
                          </View>
                        )}

                        <View style={styles.flowActionRow}>
                          <Button
                            label="Cancel"
                            variant="outline"
                            size="small"
                            onPress={() => {
                              setShowCompleteFlow(false);
                              setCompletionPhotoUri(null);
                            }}
                            disabled={completeLoading}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label={completeLoading ? 'Completing…' : 'Finish Job'}
                            size="small"
                            onPress={handleConfirmComplete}
                            disabled={completeLoading}
                            style={{ flex: 1.3 }}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* FULL-SCREEN IMAGE PREVIEW MODAL */}
      {previewImage && (
        <Modal visible={previewImage !== null} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <Pressable style={styles.imageOverlay} onPress={() => setPreviewImage(null)}>
            <Image source={{ uri: previewImage }} style={styles.fullImage} contentFit="contain" />
            <Pressable style={styles.closeImageBtn} onPress={() => setPreviewImage(null)}>
              <Feather name="x" size={26} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  summaryCard: { borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5, marginTop: 2 },
  summaryStats: { alignItems: 'flex-end' },
  statsText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  tabsRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabButtonText: { fontSize: 13 },
  list: { gap: 12 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  jobServiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, flex: 1 },
  statusPill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  agreedAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  agreedAmountLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  agreedAmountValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  jobProblem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  clientAndLocationRow: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  infoSubText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  viewDetailsText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  photoAttachedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalRef: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 6 },
  modalScroll: { gap: 14, paddingBottom: 30 },
  detailHighlightCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailHighlightLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  detailHighlightPrice: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 2 },
  modalStatusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  modalStatusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  sectionBlock: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeading: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  clientDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18 },
  clientName: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  clientPhone: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  clientActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  clientActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  clientActionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  locationDetailRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  locationText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1, lineHeight: 18 },
  navActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  navActionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  problemDetailText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  mediaThumbnailWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  mediaThumbnail: { width: 60, height: 60, borderRadius: 10 },
  mediaThumbLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  completedWorkImage: { width: '100%', height: 180, borderRadius: 12 },
  actionsContainer: { marginTop: 6 },
  twoActionRow: { flexDirection: 'row', gap: 10 },
  flowBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  flowTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  flowSub: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  inputBox: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 70, fontSize: 13 },
  flowActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoPreviewCard: { position: 'relative', width: '100%', height: 180, borderRadius: 12, overflow: 'hidden' },
  completionPreviewImg: { width: '100%', height: '100%' },
  removePhotoBtn: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  photoPickersRow: { flexDirection: 'row', gap: 10 },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  pickBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  imageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  fullImage: { width: '100%', height: '80%' },
  closeImageBtn: { position: 'absolute', top: 48, right: 24, padding: 10 },
});

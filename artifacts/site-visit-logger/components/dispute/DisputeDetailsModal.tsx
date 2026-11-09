import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useDisputes, type DisputeRecord, type DisputePartyRole } from '@/context/DisputeContext';

interface DisputeDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  dispute: DisputeRecord;
  currentRole?: DisputePartyRole | 'admin';
  onOpenResponseModal?: () => void;
}

export function DisputeDetailsModal({
  visible,
  onClose,
  dispute,
  currentRole = 'admin',
  onOpenResponseModal,
}: DisputeDetailsModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { resolveDisputeAsAdmin, dismissDisputeAsAdmin } = useDisputes();

  // Admin amendment states
  const [isAdminMode, setIsAdminMode] = useState(currentRole === 'admin');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [settledAmount, setSettledAmount] = useState(
    dispute.agreedPrice ? String(dispute.agreedPrice) : ''
  );
  const [refundAmount, setRefundAmount] = useState('0');
  const [actionTaken, setActionTaken] = useState('Amended settlement terms agreed by both parties');
  const [isSubmittingRuling, setIsSubmittingRuling] = useState(false);

  const clientStmt = dispute.statements.find((s) => s.submittedBy === 'client');
  const techStmt = dispute.statements.find((s) => s.submittedBy === 'technician');

  const hasResponded =
    currentRole === 'client' ? !!clientStmt : currentRole === 'technician' ? !!techStmt : true;

  const handleAdminResolve = async () => {
    if (!resolutionNotes.trim()) {
      Alert.alert('Required Notes', 'Please enter administrative amendment notes or justification.');
      return;
    }

    setIsSubmittingRuling(true);
    try {
      await resolveDisputeAsAdmin(dispute.id, {
        resolutionNotes: resolutionNotes.trim(),
        settledAmount: settledAmount ? parseFloat(settledAmount) : undefined,
        refundAmount: refundAmount ? parseFloat(refundAmount) : 0,
        actionTaken,
      });

      Alert.alert('Dispute Resolved', 'The dispute has been officially resolved and terms amended.');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not resolve dispute. Try again.');
    } finally {
      setIsSubmittingRuling(false);
    }
  };

  const handleAdminDismiss = async () => {
    Alert.prompt
      ? Alert.prompt(
          'Dismiss Dispute',
          'Reason for dismissal:',
          async (notes) => {
            if (notes) {
              await dismissDisputeAsAdmin(dispute.id, notes);
              onClose();
            }
          }
        )
      : Alert.alert('Dismiss Dispute', 'Dismiss this dispute without amending terms?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Dismiss',
            style: 'destructive',
            onPress: async () => {
              await dismissDisputeAsAdmin(dispute.id, 'Dismissed by administrator after review.');
              onClose();
            },
          },
        ]);
  };

  const statusColor =
    dispute.status === 'RESOLVED'
      ? colors.success
      : dispute.status === 'DISMISSED'
      ? colors.mutedForeground
      : colors.warning;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                    {dispute.status.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={[styles.jobRef, { color: colors.mutedForeground }]}>
                  Job: {dispute.service}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>Dispute Settlement Center</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Parties info bar */}
            <View style={[styles.partiesCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.partyColumn}>
                <Text style={[styles.partyRoleLabel, { color: colors.mutedForeground }]}>CLIENT</Text>
                <Text style={[styles.partyName, { color: colors.foreground }]} numberOfLines={1}>
                  {dispute.clientName}
                </Text>
                <Text style={[styles.partyPhone, { color: colors.mutedForeground }]}>
                  {dispute.clientPhone}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.partyColumn}>
                <Text style={[styles.partyRoleLabel, { color: colors.mutedForeground }]}>TECHNICIAN</Text>
                <Text style={[styles.partyName, { color: colors.foreground }]} numberOfLines={1}>
                  {dispute.technicianName}
                </Text>
                <Text style={[styles.partyPhone, { color: colors.mutedForeground }]}>
                  {dispute.technicianPhone}
                </Text>
              </View>
            </View>

            {/* Resolved Ruling Banner if already decided */}
            {dispute.ruling ? (
              <View
                style={[
                  styles.rulingCard,
                  {
                    backgroundColor: colors.successMuted,
                    borderColor: colors.success,
                  },
                ]}
              >
                <View style={styles.rulingHeader}>
                  <Feather name="check-circle" size={17} color={colors.success} />
                  <Text style={[styles.rulingTitle, { color: colors.success }]}>
                    Admin Resolution Decision
                  </Text>
                </View>
                <Text style={[styles.rulingNotes, { color: colors.foreground }]}>
                  {dispute.ruling.resolutionNotes}
                </Text>
                <View style={styles.rulingMetaRow}>
                  {dispute.ruling.settledAmount !== undefined ? (
                    <Text style={[styles.rulingMeta, { color: colors.foreground }]}>
                      Settled Price: <Text style={{ fontWeight: '700' }}>RWF {dispute.ruling.settledAmount.toLocaleString()}</Text>
                    </Text>
                  ) : null}
                  {dispute.ruling.refundAmount ? (
                    <Text style={[styles.rulingMeta, { color: colors.destructive }]}>
                      Refund: RWF {dispute.ruling.refundAmount.toLocaleString()}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.rulingFooter, { color: colors.mutedForeground }]}>
                  Action: {dispute.ruling.actionTaken} · By {dispute.ruling.resolvedBy}
                </Text>
              </View>
            ) : null}

            {/* Client Statement Card */}
            <View style={[styles.statementCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.statementHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                  <Feather name="user" size={13} color="#ffffff" />
                </View>
                <Text style={[styles.statementBy, { color: colors.foreground }]}>
                  Client Statement: {dispute.clientName}
                </Text>
              </View>
              {clientStmt ? (
                <>
                  <Text style={[styles.stmtReason, { color: colors.primary }]}>
                    Reason: {clientStmt.reason}
                  </Text>
                  <Text style={[styles.stmtText, { color: colors.foreground }]}>
                    "{clientStmt.description}"
                  </Text>
                  <Text style={[styles.stmtOutcome, { color: colors.mutedForeground }]}>
                    Desired outcome: <Text style={{ color: colors.foreground }}>{clientStmt.desiredOutcome}</Text>
                  </Text>
                  {clientStmt.evidencePhotoUri ? (
                    <Image source={{ uri: clientStmt.evidencePhotoUri }} style={styles.stmtImage} />
                  ) : null}
                </>
              ) : (
                <Text style={[styles.missingStmt, { color: colors.mutedForeground }]}>
                  Client has not yet submitted a statement for this dispute.
                </Text>
              )}
            </View>

            {/* Technician Statement Card */}
            <View style={[styles.statementCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.statementHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.secondaryForeground }]}>
                  <Feather name="tool" size={13} color="#ffffff" />
                </View>
                <Text style={[styles.statementBy, { color: colors.foreground }]}>
                  Technician Statement: {dispute.technicianName}
                </Text>
              </View>
              {techStmt ? (
                <>
                  <Text style={[styles.stmtReason, { color: colors.secondaryForeground }]}>
                    Reason: {techStmt.reason}
                  </Text>
                  <Text style={[styles.stmtText, { color: colors.foreground }]}>
                    "{techStmt.description}"
                  </Text>
                  <Text style={[styles.stmtOutcome, { color: colors.mutedForeground }]}>
                    Desired outcome: <Text style={{ color: colors.foreground }}>{techStmt.desiredOutcome}</Text>
                  </Text>
                  {techStmt.evidencePhotoUri ? (
                    <Image source={{ uri: techStmt.evidencePhotoUri }} style={styles.stmtImage} />
                  ) : null}
                </>
              ) : (
                <Text style={[styles.missingStmt, { color: colors.mutedForeground }]}>
                  Technician has not yet submitted a statement for this dispute.
                </Text>
              )}
            </View>

            {/* If user needs to respond */}
            {!hasResponded && onOpenResponseModal && dispute.status !== 'RESOLVED' ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenResponseModal();
                }}
                style={[styles.respondCtaBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="edit-3" size={15} color="#ffffff" />
                <Text style={styles.respondCtaText}>Submit Your Side of the Dispute</Text>
              </Pressable>
            ) : null}

            {/* Admin Resolution & Amendment Panel */}
            {dispute.status !== 'RESOLVED' && (
              <View
                style={[
                  styles.adminPanel,
                  {
                    backgroundColor: isDark ? colors.card : colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.adminPanelHeader}>
                  <Feather name="sliders" size={16} color={colors.primary} />
                  <Text style={[styles.adminPanelTitle, { color: colors.foreground }]}>
                    Admin Mediation & Amendment Tool
                  </Text>
                </View>
                <Text style={[styles.adminHint, { color: colors.mutedForeground }]}>
                  Review the statements above and amend settlement terms, fee adjustments, or refund actions.
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Amendment Notes & Ruling:</Text>
                <TextInput
                  style={[
                    styles.adminInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="Detail the agreed compromise or final decision (e.g. 50% price reduction, re-repair free)..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  value={resolutionNotes}
                  onChangeText={setResolutionNotes}
                />

                <View style={styles.amountRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Settled Fee (RWF):</Text>
                    <TextInput
                      style={[
                        styles.adminShortInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.foreground,
                        },
                      ]}
                      keyboardType="numeric"
                      placeholder="e.g. 15000"
                      placeholderTextColor={colors.mutedForeground}
                      value={settledAmount}
                      onChangeText={setSettledAmount}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Refund Amount (RWF):</Text>
                    <TextInput
                      style={[
                        styles.adminShortInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.foreground,
                        },
                      ]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      value={refundAmount}
                      onChangeText={setRefundAmount}
                    />
                  </View>
                </View>

                <View style={styles.adminBtnRow}>
                  <Pressable
                    onPress={handleAdminDismiss}
                    style={[styles.dismissBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.dismissBtnText, { color: colors.mutedForeground }]}>
                      Dismiss
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAdminResolve}
                    disabled={isSubmittingRuling}
                    style={[styles.resolveBtn, { backgroundColor: colors.success }]}
                  >
                    <Feather name="check" size={15} color="#ffffff" />
                    <Text style={styles.resolveBtnText}>Amend &amp; Resolve</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
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
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  jobRef: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  partiesCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  partyColumn: {
    flex: 1,
  },
  divider: {
    width: 1,
    marginHorizontal: 12,
  },
  partyRoleLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 3,
  },
  partyName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  partyPhone: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  rulingCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  rulingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  rulingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  rulingNotes: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  rulingMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  rulingMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  rulingFooter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  statementCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  statementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementBy: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  stmtReason: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 4,
  },
  stmtText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  stmtOutcome: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  stmtImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginTop: 8,
  },
  missingStmt: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
  },
  respondCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  respondCtaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  adminPanel: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  adminPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adminPanelTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  adminHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 6,
  },
  adminInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  adminShortInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  adminBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dismissBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resolveBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#ffffff',
  },
});


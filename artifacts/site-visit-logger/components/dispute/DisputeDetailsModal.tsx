import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { type DisputeRecord, type DisputePartyRole } from '@/context/DisputeContext';
import { Button } from '@/components/ui/Button';

interface DisputeDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  dispute: DisputeRecord;
  currentRole: DisputePartyRole;
  onOpenResponseModal?: () => void;
}

export function DisputeDetailsModal({
  visible,
  onClose,
  dispute,
  currentRole,
  onOpenResponseModal,
}: DisputeDetailsModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const clientStmt = dispute.statements.find((s) => s.submittedBy === 'client');
  const techStmt = dispute.statements.find((s) => s.submittedBy === 'technician');

  const hasMyStatement = currentRole === 'client' ? !!clientStmt : !!techStmt;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Disagreement &amp; Dispute
              </Text>
              <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>
                {dispute.service} • Ref: {dispute.jobReference || dispute.jobId}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#000000' : colors.muted, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Status notice */}
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: isDark ? '#000000' : colors.secondary,
                  borderColor: isDark ? colors.primary : colors.border,
                  borderWidth: isDark ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.noticeHeader}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.noticeBadge, { color: colors.primary }]}>
                  {dispute.status === 'UNDER_REVIEW' ? 'UNDER ADMIN REVIEW' : 'SUBMITTED TO WEB ADMIN'}
                </Text>
              </View>
              <Text style={[styles.noticeBody, { color: colors.foreground }]}>
                This issue has been submitted to the Fundi Admin Portal. A customer support administrator on the web dashboard reviews both client and technician submissions to mediate and resolve disagreements.
              </Text>
            </View>

            {/* Client Statement */}
            <View
              style={[
                styles.statementCard,
                {
                  backgroundColor: isDark ? '#000000' : colors.background,
                  borderColor: isDark ? colors.border : colors.border,
                },
              ]}
            >
              <View style={styles.statementHeader}>
                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.primary }]}>CLIENT STATEMENT</Text>
                  </View>
                  {clientStmt && (
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {formatDate(clientStmt.createdAt)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.partyName, { color: colors.foreground }]}>
                  {dispute.clientName} ({dispute.clientPhone || 'Client'})
                </Text>
              </View>

              {clientStmt ? (
                <View style={styles.statementContent}>
                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Reported Issue</Text>
                    <Text style={[styles.reasonValue, { color: colors.primary }]}>{clientStmt.reason}</Text>
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Details &amp; Explanation</Text>
                    <Text style={[styles.fieldValue, { color: colors.foreground }]}>{clientStmt.description}</Text>
                  </View>

                  {clientStmt.desiredOutcome ? (
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Desired Outcome</Text>
                      <Text style={[styles.fieldValue, { color: colors.foreground }]}>{clientStmt.desiredOutcome}</Text>
                    </View>
                  ) : null}

                  {clientStmt.evidencePhotoUri ? (
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Submitted Evidence</Text>
                      <Image source={{ uri: clientStmt.evidencePhotoUri }} style={styles.evidenceImage} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.emptyStatementText, { color: colors.mutedForeground }]}>
                  No statement submitted by the client yet.
                </Text>
              )}
            </View>

            {/* Technician Statement */}
            <View
              style={[
                styles.statementCard,
                {
                  backgroundColor: isDark ? '#000000' : colors.background,
                  borderColor: isDark ? colors.border : colors.border,
                },
              ]}
            >
              <View style={styles.statementHeader}>
                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: colors.tint + '20' }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.tint }]}>TECHNICIAN STATEMENT</Text>
                  </View>
                  {techStmt && (
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {formatDate(techStmt.createdAt)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.partyName, { color: colors.foreground }]}>
                  {dispute.technicianName} ({dispute.technicianPhone || 'Technician'})
                </Text>
              </View>

              {techStmt ? (
                <View style={styles.statementContent}>
                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Reported Issue</Text>
                    <Text style={[styles.reasonValue, { color: colors.tint }]}>{techStmt.reason}</Text>
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Details &amp; Explanation</Text>
                    <Text style={[styles.fieldValue, { color: colors.foreground }]}>{techStmt.description}</Text>
                  </View>

                  {techStmt.desiredOutcome ? (
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Desired Outcome</Text>
                      <Text style={[styles.fieldValue, { color: colors.foreground }]}>{techStmt.desiredOutcome}</Text>
                    </View>
                  ) : null}

                  {techStmt.evidencePhotoUri ? (
                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Submitted Evidence</Text>
                      <Image source={{ uri: techStmt.evidencePhotoUri }} style={styles.evidenceImage} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.emptyStatementText, { color: colors.mutedForeground }]}>
                  No statement submitted by technician yet.
                </Text>
              )}
            </View>

            {/* Prompt to submit response if this user hasn't submitted yet */}
            {!hasMyStatement && onOpenResponseModal ? (
              <View
                style={[
                  styles.ctaBox,
                  {
                    backgroundColor: isDark ? '#000000' : colors.card,
                    borderColor: colors.primary,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Text style={[styles.ctaHeading, { color: colors.foreground }]}>
                  You haven&apos;t submitted your statement
                </Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
                  Explain your side of the disagreement so the web administrator can review both sides fairly.
                </Text>
                <Button
                  label="Submit Your Side"
                  icon="create-outline"
                  onPress={() => {
                    onClose();
                    onOpenResponseModal();
                  }}
                  style={{ marginTop: 8 }}
                />
              </View>
            ) : null}

            {/* Dismiss button */}
            <Button
              label="Close"
              variant="outline"
              onPress={onClose}
              style={{ marginTop: 10 }}
            />
          </ScrollView>
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
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  subTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    gap: 14,
    paddingBottom: 24,
  },
  noticeBanner: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeBadge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  noticeBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  statementCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  statementHeader: {
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  dateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  partyName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  statementContent: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
    paddingTop: 8,
  },
  fieldBlock: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  reasonValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  fieldValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  evidenceImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyStatementText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  ctaBox: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  ctaHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  ctaSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
});


import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useDisputes, type DisputeRecord, type DisputeStatus } from '@/context/DisputeContext';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';

export default function DisputesScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const { disputes } = useDisputes();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);

  const filteredDisputes = disputes.filter((d) => {
    if (activeFilter === 'ACTIVE') {
      return d.status === 'OPEN' || d.status === 'UNDER_REVIEW';
    }
    if (activeFilter === 'RESOLVED') {
      return d.status === 'RESOLVED' || d.status === 'DISMISSED';
    }
    return true;
  });

  return (
    <StageScreen
      eyebrow="Admin Center"
      title="Dispute Settlement"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      <View style={styles.container}>
        <Text style={[styles.introText, { color: colors.mutedForeground }]}>
          Review disputes reported between clients and technicians. Inspect statements from both sides, examine evidence, and amend settlement terms.
        </Text>

        {/* Filter tabs */}
        <View style={[styles.filterRow, { backgroundColor: colors.muted }]}>
          {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((tab) => {
            const selected = activeFilter === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveFilter(tab)}
                style={[
                  styles.filterTab,
                  selected && [
                    styles.filterTabActive,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    {
                      color: selected ? colors.foreground : colors.mutedForeground,
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {tab === 'ALL' ? 'All Disputes' : tab === 'ACTIVE' ? 'Active / Under Review' : 'Resolved'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Dispute List */}
        {filteredDisputes.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="shield" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Disputes Found</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {activeFilter === 'ACTIVE'
                ? 'There are currently no open or under-review disputes between clients and technicians.'
                : 'No dispute records have been logged yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredDisputes.map((dispute) => {
              const statusColor =
                dispute.status === 'RESOLVED'
                  ? colors.success
                  : dispute.status === 'DISMISSED'
                  ? colors.mutedForeground
                  : colors.warning;

              const clientStmt = dispute.statements.find((s) => s.submittedBy === 'client');
              const techStmt = dispute.statements.find((s) => s.submittedBy === 'technician');

              return (
                <Pressable
                  key={dispute.id}
                  onPress={() => setSelectedDispute(dispute)}
                  style={({ pressed }) => [
                    styles.disputeCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.disputeHeader}>
                    <View style={styles.serviceRow}>
                      <Text style={[styles.serviceTitle, { color: colors.foreground }]}>
                        {dispute.service}
                      </Text>
                      {dispute.jobReference ? (
                        <Text style={[styles.jobRef, { color: colors.mutedForeground }]}>
                          · #{dispute.jobReference}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {dispute.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  {/* Summary of parties */}
                  <View style={styles.metaRow}>
                    <View style={styles.partyInfo}>
                      <Feather name="user" size={12} color={colors.primary} />
                      <Text style={[styles.partyText, { color: colors.foreground }]} numberOfLines={1}>
                        Client: {dispute.clientName}
                      </Text>
                    </View>
                    <View style={styles.partyInfo}>
                      <Feather name="tool" size={12} color={colors.secondaryForeground} />
                      <Text style={[styles.partyText, { color: colors.foreground }]} numberOfLines={1}>
                        Tech: {dispute.technicianName}
                      </Text>
                    </View>
                  </View>

                  {/* Statement indicator */}
                  <View style={[styles.statementsCountRow, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.statementCounter, { color: colors.mutedForeground }]}>
                      Statements: {clientStmt ? '✓ Client' : 'Pending Client'} ·{' '}
                      {techStmt ? '✓ Tech' : 'Pending Tech'}
                    </Text>
                    <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Details & Resolution Modal */}
      {selectedDispute ? (
        <DisputeDetailsModal
          visible={!!selectedDispute}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          currentRole="admin"
        />
      ) : null}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 30,
  },
  introText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    borderWidth: 1,
  },
  filterTabText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  list: {
    gap: 12,
  },
  disputeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  serviceTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  jobRef: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  partyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  partyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  statementsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statementCounter: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
});


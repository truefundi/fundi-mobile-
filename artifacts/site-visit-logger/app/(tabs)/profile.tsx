import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AppHeader } from '@/components/ui/AppHeader';
import { ModeSlider } from '@/components/ui/ModeSlider';
import { formatPhone, initialsOf } from '@/constants/auth';
import { formatMoney, isClosed } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';

type Link = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Omitted for the areas that arrive with the accounts release. */
  href?: Href;
};

const LINKS: Link[] = [
  { icon: 'briefcase-outline', label: 'My services', href: '/activity' },
  { icon: 'card-outline', label: 'Payments', href: '/payments' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
  { icon: 'location-outline', label: 'Saved locations' },
  { icon: 'help-circle-outline', label: 'Help & support' },
  { icon: 'settings-outline', label: 'Settings' },
];

/** Which irreversible action is waiting on a confirmation. */
type PendingAction = 'signOut' | 'delete';

/** Spec 21 — the customer account hub. */
export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobs } = useFundi();
  const { mode, setMode, status, profile, mine, done, earnings } = useWork();
  const { account, signOut, deleteAccount } = useAuth();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const completed = jobs.filter((job) => job.status === 'COMPLETED').length;
  const active = jobs.filter((job) => !isClosed(job.status)).length;

  // The tabs only exist behind the sign-in guard; this covers the frame in
  // which the session has gone but the screen has not been torn down yet.
  if (!account) return null;

  const confirm = async () => {
    if (!pendingAction) return;
    setIsBusy(true);
    try {
      // Both paths clear the session, so the router drops back to sign-in.
      if (pendingAction === 'delete') await deleteAccount();
      else await signOut();
    } finally {
      setIsBusy(false);
      setPendingAction(null);
    }
  };

  const working = mode === 'working';
  const modeHint = !working
    ? 'Find and hire a technician'
    : status === 'verified'
      ? `Taking jobs${profile ? ` · ${profile.trade}` : ''}`
      : status === 'pending'
        ? 'Documents under review'
        : 'Documents needed before you can go online';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        // The tab bar floats over the content, so the last rows need room to clear it.
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 108 : insets.bottom + 92 }}
        showsVerticalScrollIndicator={false}
      >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR FUNDI ACCOUNT</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryForeground }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initialsOf(account.name)}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text testID="profile-name" style={[styles.name, { color: colors.primaryForeground }]}>{account.name}</Text>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={13} color={colors.primaryForeground} />
            <Text testID="profile-phone" style={[styles.contact, { color: colors.secondary }]}>{formatPhone(account.phone)}</Text>
          </View>
          <Text style={[styles.contact, { color: colors.secondary }]}>{account.location}</Text>
        </View>
      </View>

      {/* The role reads as a card here — what you are now, then the slider that
          moves you — so the same drag as the home screen sits under a label
          that spells out where it leaves you. */}
      <View style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modeTop}>
          <View style={[styles.modeIcon, { backgroundColor: working ? colors.primary : colors.muted }]}>
            <Feather name={working ? 'tool' : 'search'} size={17} color={working ? colors.primaryForeground : colors.mutedForeground} />
          </View>
          <View style={styles.modeCopy}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>{working ? 'Working' : 'Hiring'}</Text>
            <Text style={[styles.modeHintText, { color: colors.mutedForeground }]}>{modeHint}</Text>
          </View>
        </View>
        <ModeSlider testID="profile-mode-slider" />
      </View>

      {/* The numbers answer to the switch: jobs you asked for, or jobs you took. */}
      {working ? (
        <View style={styles.statRow}>
          <Stat value={String(mine.length + done.length)} label={mine.length + done.length === 1 ? 'Job taken' : 'Jobs taken'} />
          <Stat value={formatMoney(earnings)} label="Earned" />
          <Stat value={profile ? `${profile.yearsExperience}y` : '—'} label="Experience" />
        </View>
      ) : (
        <View style={styles.statRow}>
          <Stat value={String(active)} label={active === 1 ? 'Active job' : 'Active jobs'} />
          <Stat value={String(completed)} label="Completed" />
          <Stat value={String(jobs.length)} label="Total requests" />
        </View>
      )}

      {working ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your trade</Text>
          <View style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tradeTop}>
              <Text style={[styles.tradeName, { color: colors.foreground }]}>{profile?.trade ?? 'Not chosen yet'}</Text>
              <View style={[styles.statusTag, { backgroundColor: status === 'verified' ? colors.successMuted : colors.warningMuted }]}>
                <Feather
                  name={status === 'verified' ? 'check-circle' : 'clock'}
                  size={12}
                  color={status === 'verified' ? colors.success : colors.warning}
                />
                <Text style={[styles.statusText, { color: colors.foreground }]}>
                  {status === 'verified' ? 'Verified' : status === 'pending' ? 'Under review' : 'Not submitted'}
                </Text>
              </View>
            </View>
            <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
              {profile
                ? `${profile.certificateUris.length} ${profile.certificateUris.length === 1 ? 'certificate' : 'certificates'} on file`
                : 'Submit your ID and a certificate to start taking jobs.'}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
      <View style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {LINKS.map((link, index) => {
          const available = !!link.href;
          const row = (
            <>
              <Ionicons name={link.icon} size={20} color={available ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.linkText, { color: available ? colors.foreground : colors.mutedForeground }]}>{link.label}</Text>
              {available ? (
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              ) : (
                <View style={[styles.soonTag, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.soonText, { color: colors.mutedForeground }]}>Soon</Text>
                </View>
              )}
            </>
          );
          const border = index < LINKS.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null;

          // Rows without a destination stay visibly inert rather than silently doing nothing.
          if (!available) {
            return (
              <View key={link.label} testID={`profile-${link.label}`} accessibilityState={{ disabled: true }} style={[styles.linkRow, border]}>
                {row}
              </View>
            );
          }
          return (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              testID={`profile-${link.label}`}
              onPress={() => router.push(link.href!)}
              style={({ pressed }) => [styles.linkRow, border, { opacity: pressed ? 0.65 : 1 }]}
            >
              {row}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Session</Text>
      <View style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          testID="profile-logout-button"
          onPress={() => setPendingAction('signOut')}
          style={({ pressed }) => [styles.linkRow, { borderBottomColor: colors.border, borderBottomWidth: 1, opacity: pressed ? 0.65 : 1 }]}
        >
          <Feather name="log-out" size={19} color={colors.foreground} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>Log out</Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          testID="profile-delete-button"
          onPress={() => setPendingAction('delete')}
          style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Feather name="trash-2" size={19} color={colors.destructive} />
          <Text style={[styles.linkText, { color: colors.destructive }]}>Delete account</Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
        Logging out keeps this account and its jobs on the device — log back in with {formatPhone(account.phone)}. Deleting removes both.
      </Text>

      <Text style={[styles.legal, { color: colors.mutedForeground }]}>Fundi · Terms & Privacy</Text>

      <ConfirmDialog
        visible={pendingAction === 'signOut'}
        title="Log out?"
        message="You will need the code sent to your phone number to log back in. Your account and jobs stay on this device."
        confirmLabel="Log out"
        busy={isBusy}
        onConfirm={confirm}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        visible={pendingAction === 'delete'}
        title="Delete your account?"
        message="This removes your Fundi account and every request, invoice and rating stored on this device. It cannot be undone."
        confirmLabel="Delete account"
        destructive
        busy={isBusy}
        onConfirm={confirm}
        onCancel={() => setPendingAction(null)}
      />
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginTop: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  profileCopy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  contact: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  modeCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 13, marginTop: 14 },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1, gap: 3 },
  modeTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  modeHintText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 13, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 21 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 24, marginBottom: 11 },
  tradeCard: { borderRadius: 16, borderWidth: 1, padding: 15, gap: 6 },
  tradeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tradeName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3, flex: 1 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  tradeMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  linkCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 54 },
  linkText: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  soonTag: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  soonText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  sectionNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 10 },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 22 },
});

import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ModeSlider } from '@/components/ui/ModeSlider';
import { PageHeading } from '@/components/ui/PageHeading';
import { formatPhone, initialsOf } from '@/constants/auth';
import { isClosed } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileKey } from '@/constants/storage';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { isServiceRejected, isWorkPending, isWorkRejected, isWorkVerified } from '@/constants/work';
import { withdrawMyService } from '@/lib/technician-services-api';
import { pickProfilePhoto } from '@/lib/profilePhoto';
import { fetchMyCompany, type MyCompany } from '@/lib/companies-api';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';
import { COMPANY_STATUS } from '@/components/work/CompanyFields';

type Link = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Omitted for the areas that arrive with the accounts release. */
  href?: Href;
};

const LINKS: Link[] = [
  { icon: 'briefcase-outline', label: 'My services', href: '/activity' },
  { icon: 'shield-checkmark-outline', label: 'Disputes & Disagreements', href: '/disputes' as any },
  { icon: 'card-outline', label: 'Payments', href: '/payments' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
  { icon: 'location-outline', label: 'Saved locations', href: '/saved-locations' },
  { icon: 'help-circle-outline', label: 'Help & support', href: '/help' },
  { icon: 'settings-outline', label: 'Settings', href: '/settings' },
];

/** Which irreversible action is waiting on a confirmation. */
type PendingAction = 'signOut' | 'delete';

/** Spec 21 — the customer account hub. */
export default function ProfileScreen() {
  const colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const bottomPadding = useTabScreenPadding();
  // No app header here, so the page clears the status bar itself.
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const router = useRouter();
  const { jobs } = useFundi();
  const { mode, setMode, status, profile, mine, done, earnings, refreshApplication } = useWork();
  // Only approved services get jobs.
  const approvedTrades = (profile?.serviceExperiences ?? []).filter((exp) => exp.status === 'APPROVED').length;
  // Approved technicians add services one at a time; each is reviewed on its own.
  const [serviceBusy, setServiceBusy] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<{ id: string; name: string } | null>(null);
  const runServiceAction = async (id: string, action: () => Promise<unknown>) => {
    setServiceBusy(id);
    setServiceError(null);
    try {
      await action();
      await refreshApplication();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setServiceBusy(null);
    }
  };
  // Opening Profile re-reads the application, so an admin's latest decision shows here.
  useFocusEffect(
    useCallback(() => {
      if (mode === 'working') void refreshApplication().catch(() => undefined);
    }, [mode, refreshApplication]),
  );
  // Whether the number is verified: requests skip the code step when it is.
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchJobPhoneStatus()
        .then((status) => {
          if (!cancelled) setPhoneVerified(status.verified);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );
  // A company owner sees their company's review status next to their trades.
  const [company, setCompany] = useState<MyCompany | null>(null);
  useFocusEffect(
    useCallback(() => {
      // Asked straight away (no company answers 404 -> null) rather than after
      // the application reloads, so the card shows as soon as Profile opens.
      if (mode !== 'working') {
        setCompany(null);
        return;
      }
      let cancelled = false;
      fetchMyCompany()
        .then((found) => {
          if (!cancelled) setCompany(found);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [mode]),
  );
  const { signOut, deleteAccount } = useAuth();
  const { profile: account, updateProfile } = useProfile();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [imageError, setImageError] = useState(false);
  const effectivePhotoUri = account?.photoUri || profile?.profilePictureUrl;

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
      if (pendingAction === 'delete') {
        const phone = account.phone;
        await deleteAccount();
        // The server account is gone, so this device's picture, places and settings go with it.
        await AsyncStorage.removeItem(profileKey(phone)).catch(() => undefined);
      } else await signOut();
    } finally {
      setIsBusy(false);
      setPendingAction(null);
    }
  };

  /** The camera on the avatar: pick a picture and save it straight away. */
  const changePhoto = async () => {
    setPhotoError('');
    try {
      const result = await pickProfilePhoto('library');
      if ('denied' in result) setPhotoError('Allow access to your photos to choose a profile picture.');
      if (!('uri' in result)) return;
      setIsSavingPhoto(true);
      await updateProfile({ name: account.name, location: account.location, photoUri: result.uri });
    } catch {
      setPhotoError('That picture could not be saved. Try another one.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const working = mode === 'working';
  const workStatusLabel =
    isWorkVerified(status) ? 'Verified' :
      isWorkPending(status) ? 'Under review' :
        isWorkRejected(status) ? 'Action required' : 'Not submitted';
  const workStatusColor =
    isWorkVerified(status) ? colors.success :
      isWorkRejected(status) ? colors.destructive :
        isWorkPending(status) ? colors.warning : colors.mutedForeground;
  
  const modeHint = !working
    ? 'Find and hire a technician'
    : isWorkVerified(status)
      ? `Taking jobs${approvedTrades ? ` · ${approvedTrades} ${approvedTrades === 1 ? 'trade' : 'trades'}` : ''}`
      : isWorkPending(status)
        ? 'Documents under review'
        : isWorkRejected(status)
          ? 'Update your documents to continue'
          : 'Documents needed before you can go online';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 18, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
      <PageHeading eyebrow="Your Fundi account" title="Profile" />

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: isDark ? '#000000' : colors.primary,
            borderWidth: isDark ? 1.5 : 0,
            borderColor: colors.primary,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={effectivePhotoUri ? 'Change your profile picture' : 'Add a profile picture'}
          accessibilityState={{ busy: isSavingPhoto }}
          testID="profile-photo-button"
          onPress={isSavingPhoto ? undefined : changePhoto}
          hitSlop={4}
          style={({ pressed }) => [styles.avatarButton, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.avatar, { backgroundColor: isDark ? '#000000' : colors.primaryForeground, borderWidth: isDark ? 1.5 : 0, borderColor: colors.primary }]}>
            {effectivePhotoUri && !imageError ? (
              <Image
                testID="profile-photo"
                source={{ uri: effectivePhotoUri }}
                style={styles.avatarImage}
                contentFit="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={[styles.avatarInitialText, { color: colors.primary }]}>
                {initialsOf(account.name)}
              </Text>
            )}
            {isSavingPhoto ? (
              <View style={[styles.avatarBusy, { backgroundColor: isDark ? '#000000' : colors.primaryForeground }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </View>
          {/* With a picture in place or initials, the camera badge stays visible so user can update */}
          {/* Dark: an orange badge ringed in the page colour; light: dark navy ringed in white on the orange header. */}
          <View
            style={[
              styles.cameraBadge,
              {
                backgroundColor: isDark ? colors.primary : colors.foreground,
                borderColor: isDark ? colors.background : colors.primaryForeground,
              },
            ]}
          >
            <Ionicons name="camera" size={12} color="#ffffff" />
          </View>
        </Pressable>
        <View style={styles.profileCopy}>
          <Text testID="profile-name" numberOfLines={2} style={[styles.name, { color: isDark ? colors.foreground : colors.primaryForeground }]}>{account.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phoneVerified ? 'Phone number verified. Change it' : 'Verify your phone number'}
            testID="profile-phone-row"
            onPress={() => router.push('/verify-number' as Href)}
            hitSlop={4}
            style={({ pressed }) => [styles.verifiedRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons
              name={phoneVerified ? 'checkmark-circle' : 'call-outline'}
              size={13}
              color={isDark ? colors.primary : colors.primaryForeground}
            />
            <Text testID="profile-phone" style={[styles.contact, { color: isDark ? colors.mutedForeground : colors.secondary }]}>{formatPhone(account.phone)}</Text>
            {phoneVerified === false ? (
              <View
                testID="profile-verify-phone"
                style={[styles.verifyChip, { backgroundColor: isDark ? colors.primary : colors.primaryForeground }]}
              >
                <Text style={[styles.verifyChipText, { color: isDark ? colors.primaryForeground : colors.primary }]}>Verify</Text>
              </View>
            ) : null}
          </Pressable>
          <View style={styles.verifiedRow}>
            <Ionicons name="location-outline" size={13} color={isDark ? colors.primary : colors.primaryForeground} />
            <Text numberOfLines={1} style={[styles.contact, styles.contactFlex, { color: isDark ? colors.mutedForeground : colors.secondary }]}>{account.location}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Update profile"
            testID="profile-edit-button"
            onPress={() => router.push('/edit-profile')}
            hitSlop={6}
            style={({ pressed }) => [
              styles.editButton,
              {
                backgroundColor: isDark ? '#000000' : colors.primaryForeground,
                borderWidth: isDark ? 1.5 : 0,
                borderColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="edit-2" size={13} color={colors.primary} />
            <Text style={[styles.editText, { color: colors.primary }]}>Update profile</Text>
          </Pressable>
        </View>
      </View>
      {photoError ? (
        <View style={styles.photoErrorRow} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={15} color={colors.destructive} />
          <Text testID="profile-photo-error" style={[styles.photoError, { color: colors.destructive }]}>{photoError}</Text>
        </View>
      ) : null}

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
          {/* The currency sits in the label so the figure stays on one line in the small tile. */}
          <Stat value={Math.round(earnings).toLocaleString('en-US')} label="Earned (RWF)" />
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
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your trades</Text>
          {profile?.serviceExperiences && profile.serviceExperiences.length > 0 ? (
            profile.serviceExperiences.map((exp, index) => {
              // Each service carries its own review status from the API.
              const expStatus = exp.status ?? (isWorkRejected(status) ? 'REJECTED' : 'PENDING');
              const isApproved = expStatus === 'APPROVED';
              const isRejected = isServiceRejected(expStatus);
              const name = exp.trade || exp.customName;
              // After approval a service is managed on its own; before, it goes with the application.
              const manage = isWorkVerified(status) && exp.id && !isApproved;
              const busy = serviceBusy === exp.id;

              const tagBg = isApproved ? colors.successMuted : isRejected ? colors.destructiveMuted : colors.warningMuted;
              const tagColor = isApproved ? colors.success : isRejected ? colors.destructive : colors.warning;
              const iconName = isApproved ? 'check-circle' : isRejected ? 'alert-circle' : 'clock';
              const statusLabel = isApproved ? 'Approved' : isRejected ? 'Not approved' : 'Under review';

              return (
                <View key={`${exp.trade}-${index}`} style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}>
                  <View style={styles.tradeTop}>
                    <Text style={[styles.tradeName, { color: colors.foreground }]}>{exp.trade || exp.customName}</Text>
                    <View style={[styles.statusTag, { backgroundColor: tagBg }]}>
                      <Feather name={iconName} size={12} color={tagColor} />
                      <Text style={[styles.statusText, { color: colors.foreground }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                    {exp.yearsOfExperience} {exp.yearsOfExperience === 1 ? 'year' : 'years'} experience
                  </Text>
                  {exp.reviewNote ? (
                    <Text style={[styles.tradeMeta, { color: colors.destructive, marginTop: 4 }]}>
                      Reason: {exp.reviewNote}
                    </Text>
                  ) : null}
                  {manage && !isRejected ? (
                    <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                      No {name} jobs until Fundi approves it.
                    </Text>
                  ) : null}
                  {manage ? (
                    <View style={styles.serviceActions}>
                      {isRejected ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => router.push({ pathname: '/add-service', params: { serviceId: exp.id! } })}
                          style={[styles.serviceAction, { backgroundColor: colors.primary }]}
                          testID={`service-resubmit-${index}`}
                        >
                          <Feather name="refresh-cw" size={13} color={colors.primaryForeground} />
                          <Text style={[styles.serviceActionText, { color: colors.primaryForeground }]}>
                            Send again
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => setWithdrawing({ id: exp.id!, name })}
                        style={[styles.serviceAction, { borderWidth: 1, borderColor: colors.border }]}
                        testID={`service-withdraw-${index}`}
                      >
                        <Feather name="x" size={13} color={colors.foreground} />
                        <Text style={[styles.serviceActionText, { color: colors.foreground }]}>Withdraw</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.tradeTop}>
                <Text style={[styles.tradeName, { color: colors.foreground }]}>Not chosen yet</Text>
                <View style={[styles.statusTag, { backgroundColor: status === 'verified' ? colors.successMuted : status === 'rejected' ? colors.destructiveMuted : colors.warningMuted }]}>
                  <Feather
                    name={status === 'verified' ? 'check-circle' : status === 'rejected' ? 'alert-circle' : 'clock'}
                    size={12}
                    color={workStatusColor}
                  />
                  <Text style={[styles.statusText, { color: colors.foreground }]}>
                    {workStatusLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                Submit your ID and a certificate to start taking jobs.
              </Text>
            </View>
          )}

          {serviceError ? (
            <Text style={[styles.tradeMeta, { color: colors.destructive, marginBottom: 8 }]}>{serviceError}</Text>
          ) : null}
          {isWorkVerified(status) && (profile?.serviceExperiences?.length ?? 0) < 10 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/add-service')}
              style={({ pressed }) => [
                styles.addService,
                { borderColor: colors.primary, backgroundColor: colors.primary + '10', opacity: pressed ? 0.8 : 1 },
              ]}
              testID="profile-add-service"
            >
              <Feather name="plus-circle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addServiceTitle, { color: colors.primary }]}>Add a service</Text>
                <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                  Offer another trade. Fundi reviews it on its own.
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          ) : null}

          {company ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your company</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${company.name}, ${COMPANY_STATUS[company.verificationStatus].label}`}
                onPress={() => router.push('/company' as Href)}
                testID="profile-company-card"
                style={({ pressed }) => [
                  styles.tradeCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={styles.tradeTop}>
                  <Text style={[styles.tradeName, { color: colors.foreground }]} numberOfLines={1}>{company.name}</Text>
                  <View
                    style={[
                      styles.statusTag,
                      { backgroundColor: colors[`${COMPANY_STATUS[company.verificationStatus].tone}Muted` as 'successMuted'] },
                    ]}
                  >
                    <Feather
                      name={COMPANY_STATUS[company.verificationStatus].icon}
                      size={12}
                      color={colors[COMPANY_STATUS[company.verificationStatus].tone]}
                    />
                    <Text style={[styles.statusText, { color: colors.foreground }]}>
                      {COMPANY_STATUS[company.verificationStatus].label}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {company.location} · {company.email}
                </Text>
              </Pressable>
            </>
          ) : null}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Appearance</Text>
      <View style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          testID="profile-theme-toggle"
          onPress={() => void toggleTheme()}
          style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>
            {isDark ? 'Dark mode' : 'Light mode'}
          </Text>
          <View style={{ backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.secondaryForeground }}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </View>
        </Pressable>
      </View>

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
        Logging out keeps your account and jobs on this device. Deleting removes both for good.
      </Text>

      <Text style={[styles.legal, { color: colors.mutedForeground }]}>Fundi · Terms & Privacy</Text>

      <ConfirmDialog
        visible={Boolean(withdrawing)}
        title={`Withdraw ${withdrawing?.name ?? 'this service'}?`}
        message="It leaves the review queue. You can add it again later."
        confirmLabel="Withdraw"
        busy={Boolean(withdrawing && serviceBusy === withdrawing.id)}
        onConfirm={() => {
          if (!withdrawing) return;
          const { id } = withdrawing;
          void runServiceAction(id, () => withdrawMyService(id)).finally(() => setWithdrawing(null));
        }}
        onCancel={() => setWithdrawing(null)}
      />
      <ConfirmDialog
        visible={pendingAction === 'signOut'}
        title="Log out?"
        message={`To log back in, use ${formatPhone(account.phone)} and the code we send to it.`}
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
  const { isDark, toggleTheme } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginTop: 20 },
  avatarButton: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 64, height: 64 },
  avatarInitialText: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  avatarBusy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 13, minHeight: 32, marginTop: 12 },
  editText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  photoErrorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 10 },
  photoError: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  profileCopy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  contact: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  verifyChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 2 },
  verifyChipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  contactFlex: { flexShrink: 1 },
  modeCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 13, marginTop: 14 },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1, gap: 3 },
  modeTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  modeHintText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 13, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 24, marginBottom: 11 },
  tradeCard: { borderRadius: 16, borderWidth: 1, padding: 15, gap: 6 },
  tradeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tradeName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3, flex: 1 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  tradeMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  serviceActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  serviceAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  serviceActionText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  addService: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 14 },
  addServiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  linkCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 54 },
  linkText: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  soonTag: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  soonText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.4 },
  sectionNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 10 },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 22 },
});
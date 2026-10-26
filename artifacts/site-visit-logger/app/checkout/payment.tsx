import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeading } from '@/components/ui/PageHeading';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import {
  MOCK_MARKETPLACE_TECHNICIANS,
  type MarketplaceTechnician,
} from '@/constants/technicians';
import {
  FLAT_BOOKING_FEE,
  FLAT_BOOKING_FEE_CURRENCY,
  formatBookingFee,
} from '@/constants/jobs';

type PaymentChannel = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'CARD_WALLET';

interface PaymentOption {
  id: PaymentChannel;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'MTN_MOMO',
    title: 'MTN Mobile Money',
    detail: 'Instant push prompt (USSD PIN confirmation)',
    icon: 'phone-portrait-outline',
    badge: 'Popular in Rwanda',
  },
  {
    id: 'AIRTEL_MONEY',
    title: 'Airtel Money',
    detail: 'Instant mobile wallet prompt',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'CARD_WALLET',
    title: 'Debit / Credit Card or Wallet',
    detail: 'Visa, Mastercard & Fundi Wallet balance',
    icon: 'card-outline',
  },
];

export default function CheckoutPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const { getJob, markBookingFeePaid, linkChatThread } = useFundi();
  const { createOrGetThread, setActiveThreadId } = useChat();

  const params = useLocalSearchParams<{
    requestId?: string;
    technicianId?: string;
    amount?: string;
    currency?: string;
  }>();

  const job = params.requestId ? getJob(params.requestId) : undefined;
  const technician: MarketplaceTechnician | undefined = useMemo(() => {
    if (params.technicianId) {
      return MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.id === params.technicianId);
    }
    if (job?.technician) {
      return MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.id === job.technician?.id);
    }
    return MOCK_MARKETPLACE_TECHNICIANS[0];
  }, [job?.technician, params.technicianId]);

  const bookingAmount = job?.bookingFee?.amount ?? (params.amount ? parseFloat(params.amount) : FLAT_BOOKING_FEE);
  const bookingCurrency = job?.bookingFee?.currency ?? params.currency ?? FLAT_BOOKING_FEE_CURRENCY;

  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel>('MTN_MOMO');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '0788123456');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>('');

  const handlePay = () => {
    if (!params.requestId && !job?.id) {
      setPaymentError('Request reference is missing. Please go back and try again.');
      return;
    }

    setPaymentError(null);
    setIsProcessing(true);

    // Simulate payment gateway processing (1.6s delay)
    setTimeout(() => {
      const targetRequestId = params.requestId || job!.id;
      const txId = `TX-${selectedChannel.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

      try {
        // 1. Update request state to mark booking fee paid
        markBookingFeePaid(targetRequestId, txId);
        setTransactionRef(txId);
        setIsProcessing(false);
        setPaymentSuccess(true);

        // 2. Prepare technician chat thread
        const updatedJob = getJob(targetRequestId);
        const techName = technician?.name ?? updatedJob?.technician?.name ?? 'Assigned Technician';
        const techPhone = technician?.phoneNumber ?? updatedJob?.technician?.phone;
        const techLocation = technician?.location ?? updatedJob?.technician?.location;

        const threadId = createOrGetThread(
          techName,
          'technician',
          targetRequestId,
          {
            id: targetRequestId,
            serviceName: updatedJob?.service ?? 'Service Request',
            problem: updatedJob?.problem ?? '',
            address: updatedJob?.locationLabel ?? '',
            thumbnailUri: updatedJob?.photoUris?.[0] ?? updatedJob?.photoUri,
            photos: updatedJob?.photoUris ?? (updatedJob?.photoUri ? [updatedJob.photoUri] : []),
            videos: updatedJob?.videoUris ?? (updatedJob?.videoUri ? [updatedJob.videoUri] : []),
            createdAt: updatedJob?.createdAt ?? new Date().toISOString(),
            status: 'ACCEPTED',
            type: updatedJob?.type ?? 'STANDARD',
            bookingFee: updatedJob?.bookingFee,
          },
          techPhone,
          techLocation,
        );

        // Link thread to request now that it is paid
        linkChatThread(targetRequestId, threadId);
        setActiveThreadId(threadId);

        // Auto-navigate to /chat/[id] after 1.4s of success animation
        setTimeout(() => {
          router.replace({
            pathname: `/chat/${threadId}` as any,
            params: {
              requestId: targetRequestId,
              firstMessage: 'true',
            },
          });
        }, 1400);
      } catch (err) {
        setIsProcessing(false);
        setPaymentError(err instanceof Error ? err.message : 'Payment authorization failed. Please retry.');
      }
    }, 1600);
  };

  const handleCancel = () => {
    // Allows back-navigation without creating or opening an active chat session
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <BackButton onPress={handleCancel} />
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Checkout Payment</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading
          eyebrow="SECURE PLATFORM PAYMENT"
          title="Pay Booking Fee"
          subtitle="Choose your preferred payment method to complete the booking."
        />

        {/* Amount Summary Banner */}
        <SectionCard emphasis>
          <Text style={[styles.amountLabel, { color: colors.primaryForeground }]}>
            TOTAL SERVICE BOOKING FEE
          </Text>
          <Text style={[styles.amountValue, { color: colors.primaryForeground }]}>
            {formatBookingFee(bookingAmount, bookingCurrency)}
          </Text>
          <Text style={[styles.amountDesc, { color: colors.secondary }]}>
            Paid once to lock in your technician and unlock direct chat
          </Text>
        </SectionCard>

        {paymentError && (
          <Notice tone="warning" icon="alert-circle-outline" text={paymentError} />
        )}

        {/* Payment Methods */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Select Payment Channel</Text>
        </View>

        <View style={[styles.channelGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {PAYMENT_OPTIONS.map((opt, idx) => {
            const isSelected = selectedChannel === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSelectedChannel(opt.id)}
                style={[
                  styles.channelItem,
                  idx < PAYMENT_OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                ]}
              >
                <View style={[styles.channelIcon, { backgroundColor: isSelected ? colors.primary + '18' : colors.muted }]}>
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.channelTitleRow}>
                    <Text style={[styles.channelTitle, { color: colors.foreground }]}>{opt.title}</Text>
                    {opt.badge && (
                      <View style={[styles.optBadge, { backgroundColor: colors.primary + '18' }]}>
                        <Text style={[styles.optBadgeText, { color: colors.primary }]}>{opt.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.channelDetail, { color: colors.mutedForeground }]}>
                    {opt.detail}
                  </Text>
                </View>

                <View style={[styles.radioCircle, { borderColor: isSelected ? colors.primary : colors.input }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Channel Details Input */}
        {(selectedChannel === 'MTN_MOMO' || selectedChannel === 'AIRTEL_MONEY') && (
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              {selectedChannel === 'MTN_MOMO' ? 'MTN Mobile Phone Number' : 'Airtel Money Phone Number'}
            </Text>
            <View style={[styles.textInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="call-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="e.g. 0788 123 456"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground }]}
              />
            </View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>
              A USSD prompt will be sent to this phone to enter your PIN.
            </Text>
          </View>
        )}

        {selectedChannel === 'CARD_WALLET' && (
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Card or Fundi Wallet</Text>
            <View style={[styles.textInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="card-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="Card Number"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground }]}
              />
            </View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>
              Fast 256-bit encrypted card charge or wallet deduction.
            </Text>
          </View>
        )}

        {/* Disclaimer / Settlement Note */}
        <Notice
          tone="neutral"
          icon="shield-checkmark-outline"
          text="This booking fee unlocks real-time chat with your technician. The final cost of the repair/service will be agreed upon and settled directly between you and the technician."
        />
      </ScrollView>

      {/* Sticky Bottom Pay CTA */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Button
          label={`Pay ${formatBookingFee(bookingAmount, bookingCurrency)}`}
          icon="lock-closed"
          onPress={handlePay}
          loading={isProcessing}
          testID="confirm-payment-button"
        />
      </View>

      {/* Payment Processing Modal */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Processing Payment</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              {selectedChannel === 'CARD_WALLET'
                ? 'Authorizing your card transaction...'
                : `Sending USSD prompt to ${phoneNumber}... Please enter your PIN on your phone.`}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Payment Success Modal */}
      <Modal visible={paymentSuccess} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.successIconCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-sharp" size={36} color={colors.success} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Payment Confirmed!</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Booking Fee paid successfully. Ref: {transactionRef}
            </Text>
            <View style={[styles.redirectNotice, { backgroundColor: colors.primary + '14' }]}>
              <Ionicons name="chatbubbles" size={16} color={colors.primary} />
              <Text style={[styles.redirectText, { color: colors.primary }]}>
                Opening technician chat session...
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  titleTop: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  amountLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  amountValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    letterSpacing: -1,
    marginVertical: 4,
  },
  amountDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  sectionHeaderRow: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  channelGroup: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  channelTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  optBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  channelDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  inputHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  redirectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  redirectText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useChat, type ChatMessage } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

export default function StandaloneChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    sendMessage,
    sendPriceOffer,
  } = useChat();
  const { getJob } = useFundi();

  const {
    id: routeId,
    requestId,
    firstMessage,
  } = useLocalSearchParams<{
    id?: string;
    requestId?: string;
    firstMessage?: string;
  }>();

  // Find target thread by thread ID or associated job/request ID
  const thread = useMemo(() => {
    if (!routeId && !requestId) return threads[0];
    return (
      threads.find((t) => t.id === routeId) ??
      threads.find((t) => t.jobId === routeId) ??
      threads.find((t) => requestId && t.jobId === requestId) ??
      threads[0]
    );
  }, [routeId, requestId, threads]);

  const [messageText, setMessageText] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNotes, setOfferNotes] = useState('');

  useEffect(() => {
    if (thread && activeThreadId !== thread.id) {
      setActiveThreadId(thread.id);
    }
  }, [thread, activeThreadId, setActiveThreadId]);

  const job = thread?.jobId ? getJob(thread.jobId) : (requestId ? getJob(requestId) : undefined);
  const otherName = thread?.otherParticipantName ?? (job?.technician?.name || 'Technician');

  const handleSend = async () => {
    if (!thread || !messageText.trim()) return;
    const textToSend = messageText.trim();
    setMessageText('');
    await sendMessage(thread.id, textToSend);
  };

  const handleSendOffer = async () => {
    if (!thread || !offerAmount) return;
    const amountNum = parseFloat(offerAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    await sendPriceOffer(thread.id, amountNum, offerNotes, account?.role === 'TECHNICIAN' ? 'technician' : 'client');
    setShowOfferModal(false);
    setOfferAmount('');
    setOfferNotes('');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top Header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <BackButton onPress={handleBack} />
        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>
            {otherName}
          </Text>
          <View style={styles.headerStatusRow}>
            <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.headerStatusText, { color: colors.mutedForeground }]}>
              {thread?.agreedPrice ? `Agreed: RWF ${thread.agreedPrice.toLocaleString()}` : 'Booking Confirmed · Chat Active'}
            </Text>
          </View>
        </View>
        <View style={{ width: 34 }} />
      </View>

      {/* Booking Confirmed / First Message Banner */}
      {firstMessage === 'true' && (
        <View style={styles.bannerPadding}>
          <Notice
            tone="success"
            icon="checkmark-circle-outline"
            text="Service Booking Fee paid successfully! You now have direct messaging with your technician to coordinate the visit and negotiate repair pricing."
          />
        </View>
      )}

      {/* Message List */}
      <FlatList
        data={thread?.messages ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isMe = item.senderId === account?.id || item.senderRole === (account?.role === 'TECHNICIAN' ? 'technician' : 'client');
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
              {/* If message has service request card */}
              {item.serviceRequest && (
                <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.reqCardHeader}>
                    <Ionicons name="construct-outline" size={18} color={colors.primary} />
                    <Text style={[styles.reqCardTitle, { color: colors.foreground }]}>
                      {item.serviceRequest.serviceName}
                    </Text>
                  </View>
                  <Text style={[styles.reqCardProblem, { color: colors.mutedForeground }]}>
                    {item.serviceRequest.problem}
                  </Text>
                  <Text style={[styles.reqCardAddress, { color: colors.mutedForeground }]}>
                    📍 {item.serviceRequest.address}
                  </Text>
                </View>
              )}

              {/* Price offer card */}
              {item.priceOffer && (
                <View style={[styles.offerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.offerLabel, { color: colors.mutedForeground }]}>Repair Price Offer</Text>
                  <Text style={[styles.offerAmount, { color: colors.foreground }]}>
                    {item.priceOffer.currency} {item.priceOffer.amount.toLocaleString()}
                  </Text>
                  {item.priceOffer.notes ? (
                    <Text style={[styles.offerNotes, { color: colors.mutedForeground }]}>
                      {item.priceOffer.notes}
                    </Text>
                  ) : null}
                  <View style={[styles.offerStatusBadge, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[styles.offerStatusText, { color: colors.primary }]}>
                      Status: {item.priceOffer.status}
                    </Text>
                  </View>
                </View>
              )}

              {/* Regular chat bubble */}
              {item.text ? (
                <View
                  style={[
                    styles.chatBubble,
                    isMe
                      ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                      : [styles.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTime,
                      { color: isMe ? colors.primaryForeground + 'B3' : colors.mutedForeground },
                    ]}
                  >
                    {time}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Send a message to start coordinating with your technician.
            </Text>
          </View>
        }
      />

      {/* Settlement Reminder Bar */}
      <View style={[styles.settlementBar, { backgroundColor: colors.secondary }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
        <Text style={[styles.settlementText, { color: colors.secondaryForeground }]}>
          Final service & labor cost is settled directly with your technician.
        </Text>
      </View>

      {/* Bottom Message Input Bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Pressable
          onPress={() => setShowOfferModal(true)}
          style={[styles.offerBtn, { backgroundColor: colors.primary + '18' }]}
        >
          <Feather name="tag" size={18} color={colors.primary} />
        </Pressable>

        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />

        <Pressable
          disabled={!messageText.trim()}
          onPress={handleSend}
          style={[
            styles.sendBtn,
            { backgroundColor: messageText.trim() ? colors.primary : colors.muted },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={messageText.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>

      {/* Propose Price Offer Modal */}
      {showOfferModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalTopRow}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Propose Repair Price</Text>
              <Pressable onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
              Enter the agreed service amount to record the direct settlement.
            </Text>

            <TextInput
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="numeric"
              placeholder="Amount in RWF (e.g. 25000)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            <TextInput
              value={offerNotes}
              onChangeText={setOfferNotes}
              placeholder="Notes (optional, e.g. includes parts)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            <Button
              label="Send Price Proposal"
              onPress={handleSendOffer}
              disabled={!offerAmount}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerStatusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  bannerPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  msgWrapper: {
    marginVertical: 4,
    maxWidth: '82%',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
    gap: 4,
  },
  reqCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqCardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  reqCardProblem: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  reqCardAddress: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  offerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
    gap: 4,
  },
  offerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  offerAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  offerNotes: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  offerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  offerStatusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  settlementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settlementText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    flex: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  offerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  modalHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
});

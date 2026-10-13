import React, { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useChat, type ChatMessage, type ServiceRequestDetails } from '@/context/ChatContext';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';

function getDateSeparatorLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ChatTabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { threadId: requestedThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const { account } = useAuth();
  const { threads, activeThreadId, setActiveThreadId, sendMessage, updateRequestStatus, sendPriceOffer, respondToOffer } = useChat();

  const [replyText, setReplyText] = useState('');
  const [selectedRequestModal, setSelectedRequestModal] = useState<ServiceRequestDetails | null>(null);
  
  // Counter Offer Modal State
  const [counterOfferModal, setCounterOfferModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNotes, setCounterNotes] = useState('');

  // Technician Price Offer Modal State
  const [techOfferModal, setTechOfferModal] = useState(false);
  const [techOfferAmount, setTechOfferAmount] = useState('');
  const [techOfferNotes, setTechOfferNotes] = useState('');

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const userRole = account?.role === 'TECHNICIAN' ? 'technician' : 'client';

  useEffect(() => {
    if (typeof requestedThreadId === 'string') setActiveThreadId(requestedThreadId);
  }, [requestedThreadId, setActiveThreadId]);

  const closeThread = () => {
    setActiveThreadId(null);
    router.setParams({ threadId: undefined });
  };

  const handleSendText = async () => {
    if (!activeThreadId || !replyText.trim()) return;
    await sendMessage(activeThreadId, replyText.trim());
    setReplyText('');
  };

  const handleSendTechOffer = async () => {
    if (!activeThreadId || !techOfferAmount) return;
    await sendPriceOffer(activeThreadId, parseFloat(techOfferAmount), techOfferNotes);
    setTechOfferAmount('');
    setTechOfferNotes('');
    setTechOfferModal(false);
  };

  const handleSendCounterOffer = async () => {
    if (!activeThreadId || !counterAmount) return;
    await sendPriceOffer(activeThreadId, parseFloat(counterAmount), counterNotes, 'client');
    setCounterAmount('');
    setCounterNotes('');
    setCounterOfferModal(false);
  };

  // Group messages by date
  const groupedMessages: { dateLabel: string; messages: ChatMessage[] }[] = [];
  if (activeThread) {
    let lastDateLabel = '';
    activeThread.messages.forEach((msg) => {
      const label = getDateSeparatorLabel(msg.timestamp);
      if (label !== lastDateLabel) {
        groupedMessages.push({ dateLabel: label, messages: [msg] });
        lastDateLabel = label;
      } else {
        groupedMessages[groupedMessages.length - 1].messages.push(msg);
      }
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      {!activeThread ? (
        <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 24 : 16 }]}>
          <PageHeading
            eyebrow="Negotiation"
            title="Service Chats"
            subtitle="Settle service pricing and review requests directly with clients and specialists."
          />

          {threads.length === 0 ? (
            <View style={[styles.emptyContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                When you connect with a technician or receive service requests, your price settlement chats will show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {threads.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveThreadId(item.id)}
                  style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>{item.otherParticipantName[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.threadRow}>
                      <Text style={[styles.threadName, { color: colors.foreground }]}>{item.otherParticipantName}</Text>
                      {item.agreedPrice ? (
                        <Text style={[styles.agreedTag, { color: colors.success }]}>RWF {item.agreedPrice.toLocaleString()} Agreed</Text>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={[styles.lastMessage, { color: colors.mutedForeground }]}>{item.lastMessage}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}
        </KeyboardAwareScrollViewCompat>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Chat Header */}
          <View style={[styles.chatHeader, { paddingTop: Platform.OS === 'web' ? 12 : 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to conversations"
              onPress={closeThread}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.chatHeaderTitle, { color: colors.foreground }]}>{activeThread.otherParticipantName}</Text>
              <Text style={[styles.chatHeaderSub, { color: colors.mutedForeground }]}>
                {activeThread.agreedPrice ? `Agreed Price: RWF ${activeThread.agreedPrice.toLocaleString()}` : 'Price Settlement Chat'}
              </Text>
            </View>
          </View>

          {/* Message List with Date Separators */}
          <FlatList
            data={groupedMessages}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.messageList}
            renderItem={({ item: group }) => (
              <View>
                <View style={[styles.dateSeparatorWrap, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.dateSeparatorText, { color: colors.secondaryForeground }]}>{group.dateLabel}</Text>
                </View>

                {group.messages.map((msg) => {
                  const isMe = msg.senderId === account?.id;
                  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <View key={msg.id} style={[styles.msgContainer, isMe ? styles.msgAlignRight : styles.msgAlignLeft]}>
                      
                      {/* SERVICE REQUEST CARD */}
                      {msg.serviceRequest ? (
                        <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.requestCardTop}>
                            {msg.serviceRequest.thumbnailUri ? (
                              <Image source={{ uri: msg.serviceRequest.thumbnailUri }} style={styles.requestThumb} />
                            ) : (
                              <View style={[styles.requestThumbFallback, { backgroundColor: colors.secondary }]}>
                                <Ionicons name="construct-outline" size={20} color={colors.primary} />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.reqTitle, { color: colors.foreground }]}>{msg.serviceRequest.serviceName} Service Request</Text>
                              <Text numberOfLines={1} style={[styles.reqLocation, { color: colors.mutedForeground }]}>
                                📍 {msg.serviceRequest.address} {msg.serviceRequest.landmark ? `· ${msg.serviceRequest.landmark}` : ''} {msg.serviceRequest.distance ? `· ${msg.serviceRequest.distance}` : ''}
                              </Text>
                              <Text numberOfLines={2} style={[styles.reqProblem, { color: colors.mutedForeground }]}>{msg.serviceRequest.problem}</Text>
                              <Pressable onPress={() => setSelectedRequestModal(msg.serviceRequest ?? null)} style={{ marginTop: 4 }}>
                                <Text style={[styles.viewDetailsLink, { color: colors.primary }]}>View Details →</Text>
                              </Pressable>
                            </View>
                          </View>

                          {/* Technician Action Buttons */}
                          {userRole === 'technician' && msg.serviceRequest.status === 'PENDING' && (
                            <View style={styles.actionButtonRow}>
                              <Button label="Accept" size="small" onPress={() => updateRequestStatus(activeThread.id, msg.serviceRequest!.id, 'ACCEPTED')} style={{ flex: 1 }} />
                              <Button label="Decline" variant="outline" size="small" onPress={() => updateRequestStatus(activeThread.id, msg.serviceRequest!.id, 'DECLINED')} style={{ flex: 1 }} />
                            </View>
                          )}

                          {/* Client Status & Cancellation */}
                          {userRole === 'client' && (
                            <View style={styles.statusFooterRow}>
                              <View style={styles.statusIndicatorWrap}>
                                <Ionicons name="time-outline" size={14} color={colors.warning} />
                                <Text style={[styles.statusText, { color: colors.foreground }]}>
                                  Status: <Text style={{ fontWeight: '700' }}>{msg.serviceRequest.status}</Text>
                                </Text>
                              </View>
                              {msg.serviceRequest.status === 'PENDING' && (
                                <Pressable onPress={() => updateRequestStatus(activeThread.id, msg.serviceRequest!.id, 'CANCELLED')}>
                                  <Text style={[styles.cancelTextBtn, { color: colors.destructive }]}>Cancel Request</Text>
                                </Pressable>
                              )}
                              {msg.serviceRequest.status === 'ACCEPTED' && (
                                <Pressable onPress={() => updateRequestStatus(activeThread.id, msg.serviceRequest!.id, 'COMPLETED')}>
                                  <Text style={[styles.cancelTextBtn, { color: colors.primary }]}>End Request</Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                          <Text style={[styles.timestampText, { color: colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      ) : msg.priceOffer ? (
                        /* SERVICE COST OFFER CARD */
                        <View style={[styles.offerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.offerCardHeader, { color: colors.mutedForeground }]}>Service Cost</Text>
                          <Text style={[styles.offerAmount, { color: colors.foreground }]}>{msg.priceOffer.currency} {msg.priceOffer.amount.toLocaleString()}</Text>
                          <Text style={[styles.offerSub, { color: colors.mutedForeground }]}>
                            {msg.priceOffer.senderRole === 'technician' ? 'Proposed by the technician' : 'Counteroffer by the client'}
                          </Text>

                          {/* Client Actions for Offer */}
                          {userRole === 'client' && msg.priceOffer.status === 'PENDING' && (
                            <View style={styles.offerActionColumn}>
                              <Button label="Accept Offer" size="small" onPress={() => respondToOffer(activeThread.id, msg.priceOffer!.id, 'ACCEPTED')} />
                              <Button label="Counter Offer" variant="outline" size="small" onPress={() => setCounterOfferModal(true)} />
                              <Pressable onPress={() => respondToOffer(activeThread.id, msg.priceOffer!.id, 'DECLINED')} style={{ alignSelf: 'center', marginTop: 6 }}>
                                <Text style={{ color: colors.destructive, fontWeight: '600', fontSize: 13 }}>Decline Offer</Text>
                              </Pressable>
                            </View>
                          )}

                          {msg.priceOffer.status !== 'PENDING' && (
                            <View style={[styles.badgeStatus, { backgroundColor: colors.secondary }]}>
                              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Offer {msg.priceOffer.status}</Text>
                            </View>
                          )}
                          <Text style={[styles.timestampText, { color: colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      ) : (
                        /* STANDARD CHAT MESSAGE */
                        <View style={[styles.standardBubble, { backgroundColor: isMe ? colors.primary : colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.standardText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>{msg.text}</Text>
                          <Text style={[styles.timestampTextSecondary, { color: isMe ? colors.primaryForeground + '80' : colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      )}

                    </View>
                  );
                })}
              </View>
            )}
          />

          {/* Technician Action Bar to Send Price Offer */}
          {userRole === 'technician' && (
            <View style={[styles.techTopBarAction, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Button label="Send Service Offer" size="small" icon="pricetag-outline" onPress={() => setTechOfferModal(true)} style={{ flex: 1 }} />
            </View>
          )}

          {/* Reply Bar */}
          <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 }]}>
            <TextInput
              placeholder="Type a message..."
              placeholderTextColor={colors.mutedForeground}
              value={replyText}
              onChangeText={setReplyText}
              style={[styles.replyInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />
            <Button label="Send" size="small" onPress={handleSendText} />
          </View>
        </View>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedRequestModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Details</Text>
                <Pressable onPress={() => setSelectedRequestModal(null)}>
                  <Feather name="x" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                <Text style={[styles.modalSub, { color: colors.primary }]}>{selectedRequestModal.serviceName}</Text>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Problem Statement:</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>{selectedRequestModal.problem}</Text>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Location & Landmark:</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>{selectedRequestModal.address} {selectedRequestModal.landmark ? `(${selectedRequestModal.landmark})` : ''}</Text>
                
                {selectedRequestModal.photos?.length > 0 && (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Photos:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
                      {selectedRequestModal.photos.map((p: string, idx: number) => (
                        <Image key={idx} source={{ uri: p }} style={styles.galleryThumb} />
                      ))}
                    </ScrollView>
                  </>
                )}
                <Button label="Close Details" variant="outline" onPress={() => setSelectedRequestModal(null)} style={{ marginTop: 12 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* TECHNICIAN OFFER MODAL */}
      <Modal visible={techOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Service Offer</Text>
            <TextInput
              placeholder="Amount in RWF (e.g. 25000)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={techOfferAmount}
              onChangeText={setTechOfferAmount}
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Optional notes or price breakdown"
              placeholderTextColor={colors.mutedForeground}
              value={techOfferNotes}
              onChangeText={setTechOfferNotes}
              multiline
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button label="Cancel" variant="outline" onPress={() => setTechOfferModal(false)} style={{ flex: 1 }} />
              <Button label="Submit Offer" onPress={handleSendTechOffer} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* CLIENT COUNTER OFFER MODAL */}
      <Modal visible={counterOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Counter Offer</Text>
            <TextInput
              placeholder="Proposed Amount in RWF"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={counterAmount}
              onChangeText={setCounterAmount}
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Reason or explanation for counteroffer"
              placeholderTextColor={colors.mutedForeground}
              value={counterNotes}
              onChangeText={setCounterNotes}
              multiline
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button label="Cancel" variant="outline" onPress={() => setCounterOfferModal(false)} style={{ flex: 1 }} />
              <Button label="Send Counter" onPress={handleSendCounterOffer} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyContainer: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 24, gap: 10 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center' },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  listWrap: { marginTop: 16, gap: 10 },
  threadCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 14 },
  avatarBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  threadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  agreedTag: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  lastMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  chatHeaderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  chatHeaderSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  messageList: { padding: 16, gap: 12 },
  dateSeparatorWrap: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, alignSelf: 'center', marginBottom: 12, marginTop: 4 },
  dateSeparatorText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  msgContainer: { marginVertical: 4, width: '100%' },
  msgAlignRight: { alignItems: 'flex-end' },
  msgAlignLeft: { alignItems: 'flex-start' },
  requestCard: { borderWidth: 1, borderRadius: 16, padding: 14, width: '88%', maxWidth: 450, gap: 12 },
  requestCardTop: { flexDirection: 'row' },
  requestThumb: { width: 64, height: 64, borderRadius: 10 },
  requestThumbFallback: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reqTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  reqLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  reqProblem: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  viewDetailsLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  actionButtonRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 10 },
  statusFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 10 },
  statusIndicatorWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  cancelTextBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  timestampText: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right', marginTop: 4 },
  offerCard: { borderWidth: 1, borderRadius: 16, padding: 16, width: '85%', maxWidth: 400, gap: 8 },
  offerCardHeader: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  offerAmount: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  offerSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  offerActionColumn: { gap: 8, marginTop: 8 },
  badgeStatus: { padding: 6, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  standardBubble: { borderWidth: 1, borderRadius: 14, padding: 12, maxWidth: '80%', gap: 4 },
  standardText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  timestampTextSecondary: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right' },
  techTopBarAction: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, flexDirection: 'row' },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, height: 42, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { borderWidth: 1, borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalSub: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  modalLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  modalValue: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  galleryThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  inputField: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginTop: 8 },
});
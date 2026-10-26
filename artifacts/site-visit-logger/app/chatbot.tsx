import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/BackButton';
import { useColors } from '@/hooks/useColors';
import { vibrate } from '@/lib/haptics';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'ai',
    text: 'Hello! I am your Fundi AI Assistant. How can I help you today? You can ask about service estimates, finding emergency technicians, or tracking active repairs.',
    timestamp: 'Just now',
  },
];

const SUGGESTIONS = [
  'How much is a visit fee?',
  'I need an emergency electrician',
  'How do I track my repair?',
  'What services do you offer?',
];

export default function ChatbotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    vibrate();
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    // Simulated AI response
    setTimeout(() => {
      let reply = "I'm here to help! Our verified technicians are available across electrical, plumbing, HVAC, and handyman repairs.";
      const lower = text.toLowerCase();
      if (lower.includes('emergency') || lower.includes('sos')) {
        reply = 'For emergencies, tap the red SOS button on your home screen or select Emergency Service for priority technician dispatch!';
      } else if (lower.includes('fee') || lower.includes('cost') || lower.includes('price')) {
        reply = 'Standard callout fees cover inspection and diagnosis upfront. You will receive an itemized quote before any repair work starts.';
      } else if (lower.includes('track') || lower.includes('where')) {
        reply = 'You can check real-time technician status directly in your Activity tab or the active job banner on Home.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: reply,
          timestamp: 'Just now',
        },
      ]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <BackButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="chatbot-back-button"
        />
        <View style={styles.headerInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name="robot" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Fundi AI Assistant
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success || '#16a34a' }]} />
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                Online
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isAi = item.sender === 'ai';
          return (
            <View
              style={[
                styles.messageRow,
                isAi ? styles.messageRowAi : styles.messageRowUser,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isAi
                    ? [
                        styles.bubbleAi,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]
                    : [
                        styles.bubbleUser,
                        {
                          backgroundColor: colors.primary,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: isAi ? colors.foreground : colors.primaryForeground,
                    },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <>
            {isTyping && (
              <View style={[styles.messageRow, styles.messageRowAi]}>
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleAi,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.typingText, { color: colors.mutedForeground }]}>
                    AI is thinking…
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Suggestions */}
            <View style={styles.suggestionContainer}>
              <Text style={[styles.suggestionTitle, { color: colors.mutedForeground }]}>
                Suggested topics:
              </Text>
              <View style={styles.chipRow}>
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => sendMessage(suggestion)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.secondaryForeground }]}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        }
      />

      {/* Input row */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'web' ? 14 : insets.bottom + 10,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
            placeholder="Ask anything or describe your issue…"
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleAi: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleUser: {
    borderTopRightRadius: 4,
  },
  messageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  typingText: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    fontSize: 13,
  },
  suggestionContainer: {
    marginTop: 16,
    paddingTop: 12,
  },
  suggestionTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

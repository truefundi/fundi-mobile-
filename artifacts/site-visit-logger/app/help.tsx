import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Notice } from '@/components/ui/Notice';
import { StageScreen } from '@/components/ui/StageScreen';
import { formatPhone } from '@/constants/auth';
import { FAQS, SUPPORT_CONTACT } from '@/constants/support';
import { useColors } from '@/hooks/useColors';

type Contact = { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string; url: string };

/** Reached from Profile: answers first, then a way to reach a person. */
export default function HelpScreen() {
  const colors = useColors();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  // Only the channels the team has filled in are shown.
  const contacts: Contact[] = [];
  if (SUPPORT_CONTACT.phone) {
    contacts.push({ icon: 'call-outline', label: 'Call us', detail: formatPhone(SUPPORT_CONTACT.phone), url: `tel:${SUPPORT_CONTACT.phone}` });
  }
  if (SUPPORT_CONTACT.whatsapp) {
    contacts.push({
      icon: 'logo-whatsapp',
      label: 'WhatsApp',
      detail: formatPhone(SUPPORT_CONTACT.whatsapp),
      url: `https://wa.me/${SUPPORT_CONTACT.whatsapp.replace(/\D/g, '')}`,
    });
  }
  if (SUPPORT_CONTACT.email) {
    contacts.push({ icon: 'mail-outline', label: 'Email', detail: SUPPORT_CONTACT.email, url: `mailto:${SUPPORT_CONTACT.email}` });
  }

  return (
    <StageScreen
      eyebrow="Help & support"
      title="How can we help?"
      subtitle="Answers to what customers ask most. Tap a question to open it."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {FAQS.map((faq, index) => {
          const expanded = open === index;
          return (
            <View key={faq.question} style={index < FAQS.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={faq.question}
                testID={`faq-${index}`}
                onPress={() => setOpen(expanded ? null : index)}
                style={({ pressed }) => [styles.question, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={[styles.questionText, { color: colors.foreground }]}>{faq.question}</Text>
                <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={expanded ? colors.primary : colors.mutedForeground} />
              </Pressable>
              {expanded ? (
                <Text testID={`faq-answer-${index}`} style={[styles.answer, { color: colors.mutedForeground }]}>{faq.answer}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Still need help?</Text>
      {contacts.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {contacts.map((contact, index) => (
            <Pressable
              key={contact.label}
              accessibilityRole="link"
              accessibilityLabel={`${contact.label}, ${contact.detail}`}
              testID={`support-${contact.label}`}
              onPress={() => Linking.openURL(contact.url).catch(() => undefined)}
              style={({ pressed }) => [
                styles.contact,
                index < contacts.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={contact.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.contactCopy}>
                <Text style={[styles.contactLabel, { color: colors.foreground }]}>{contact.label}</Text>
                <Text style={[styles.contactDetail, { color: colors.mutedForeground }]}>{contact.detail}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Notice tone="info" icon="chatbubbles-outline" text="The support team's phone, WhatsApp and email will be listed here." />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Problem with a job? Open Activity"
        testID="help-open-activity"
        onPress={() => router.navigate('/activity')}
        style={({ pressed }) => [styles.jobLink, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.contactIcon, { backgroundColor: colors.secondary }]}>
          <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.contactCopy}>
          <Text style={[styles.contactLabel, { color: colors.foreground }]}>Problem with a job?</Text>
          <Text style={[styles.contactDetail, { color: colors.mutedForeground }]}>Open it in Activity to see its status, quote and invoice.</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  question: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  questionText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  answer: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, paddingBottom: 15, marginTop: -2 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 10 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62 },
  contactIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  contactCopy: { flex: 1 },
  contactLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  contactDetail: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  jobLink: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
});

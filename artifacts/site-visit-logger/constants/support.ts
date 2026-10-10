import { EMERGENCY_VISIT_FEE, formatMoney, VISIT_FEE } from './jobs';

/**
 * How customers reach the Fundi support team. Empty values are hidden on the
 * Help screen; fill them in with the team's real details.
 */
export const SUPPORT_CONTACT = {
  /** E.164, e.g. +250788000000. */
  phone: '',
  /** WhatsApp number in E.164. */
  whatsapp: '',
  email: '',
};

export type Faq = { question: string; answer: string };

/** Answers that match how the app behaves today. Update them when the flow changes. */
export const FAQS: Faq[] = [
  {
    question: 'How does Fundi work?',
    answer:
      'Describe the problem and where you are. Fundi finds a verified technician nearby. You pay the visit fee, the technician checks the problem and sends a quote, and you approve it before any repair starts.',
  },
  {
    question: 'What is the visit fee?',
    answer: `It covers the visit and the diagnosis: ${formatMoney(VISIT_FEE)}, or ${formatMoney(EMERGENCY_VISIT_FEE)} for an emergency. If you approve the quote, it is taken off your repair total.`,
  },
  {
    question: 'Can I cancel a request?',
    answer:
      'Yes, until you pay the visit fee: while we are searching, once a technician is found, or on the visit fee screen. The app asks you to confirm first.',
  },
  {
    question: 'What if I do not agree with the quote?',
    answer:
      'You can decline it, and the job is closed. Nothing more is charged for the repair. The visit fee follows Fundi\'s cancellation and refund policy.',
  },
  {
    question: 'How can I pay?',
    answer:
      'The visit fee is paid by card, mobile money or Fundi Wallet. The repair balance can be paid through Fundi, in cash, by mobile money or another way you agree with the technician.',
  },
  {
    question: 'Are technicians checked?',
    answer: 'Yes. Every technician sends a photo of their national ID and a certificate for their trade, and is reviewed before they can take jobs.',
  },
  {
    question: 'Where do I find my invoices?',
    answer: 'Open a finished job in Activity, or go to Profile, then Payments. Each payment links to its invoice.',
  },
];

import { FLAT_BOOKING_FEE, formatBookingFee } from './jobs';

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
      'Describe your problem and location, then choose an available technician or request emergency dispatch. After confirming the Service Booking Fee, your request opens in chat to coordinate and negotiate agreed service pricing before work begins.',
  },
  {
    question: 'What is the Service Booking Fee?',
    answer: `The Service Booking Fee (${formatBookingFee(FLAT_BOOKING_FEE)}) secures your technician and unlocks real-time direct chat and dispatch. Service labor and replacement parts are agreed upon directly with your technician in chat.`,
  },
  {
    question: 'Can I cancel a request?',
    answer:
      'Yes, you can cancel before confirming the booking fee or prior to technician cooperation agreement. The app asks you to confirm first.',
  },
  {
    question: 'What if I do not agree with the service price offer?',
    answer:
      'You can make counter-offers or decline the price offer in chat. If no agreement is reached, the negotiation closes without further charges.',
  },
  {
    question: 'How can I pay?',
    answer:
      'The Service Booking Fee is paid securely via Mobile Money or Card through Fundi. Agreed service balances can be paid through Fundi or settled directly with your technician.',
  },
  {
    question: 'Are technicians checked?',
    answer: 'Yes. Every technician sends a photo of their national ID and professional trade credentials, and is vetted before taking jobs.',
  },
  {
    question: 'Where do I find my invoices?',
    answer: 'Open a finished job in Activity, or go to Profile, then Payments. Each payment links to its receipt.',
  },
];

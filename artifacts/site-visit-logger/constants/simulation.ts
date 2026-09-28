/**
 * Stand-in technician behaviour.
 *
 * Until the matching service and technician app exist, the customer journey is
 * driven by timers here. Every value in this file is placeholder data — when
 * the backend lands, delete this file and read the same shapes from the API.
 */

import type { AdditionalWork, JobStatus, Quote, Technician } from './jobs';

export const TECHNICIANS: Technician[] = [
  { id: 'tech-1', name: 'John Smith', skill: 'Electrician', rating: 4.8, jobsCompleted: 1250, distanceKm: 5, etaMinutes: 14, initials: 'JS', phone: '+250 788 111 222', yearsExperience: 9 },
  { id: 'tech-2', name: 'Moses Nkurunziza', skill: 'Auto mechanic', rating: 4.9, jobsCompleted: 870, distanceKm: 3.2, etaMinutes: 11, initials: 'MN', phone: '+250 788 333 444', yearsExperience: 12 },
  { id: 'tech-3', name: 'Grace Uwase', skill: 'Plumber', rating: 4.7, jobsCompleted: 640, distanceKm: 6.4, etaMinutes: 18, initials: 'GU', phone: '+250 788 555 666', yearsExperience: 7 },
  { id: 'tech-4', name: 'Eric Habimana', skill: 'HVAC technician', rating: 4.8, jobsCompleted: 410, distanceKm: 4.1, etaMinutes: 13, initials: 'EH', phone: '+250 788 777 888', yearsExperience: 6 },
];

/** Pick the technician whose trade best fits the requested service. */
export function matchTechnician(service: string): Technician {
  const table: Record<string, string> = {
    'Car & Garage': 'tech-2',
    'Truck & Mechanical': 'tech-2',
    Electrical: 'tech-1',
    'Emergency Service': 'tech-1',
    Plumbing: 'tech-3',
    HVAC: 'tech-4',
    'Appliance Repair': 'tech-4',
    'Home Repair': 'tech-3',
    'General Maintenance': 'tech-1',
  };
  const id = table[service] ?? 'tech-1';
  return TECHNICIANS.find((technician) => technician.id === id) ?? TECHNICIANS[0]!;
}

/** The diagnosis and quote the technician "submits" once on site. */
export function buildQuote(service: string): Quote {
  switch (service) {
    case 'Car & Garage':
    case 'Truck & Mechanical':
      return {
        diagnosis: 'Faulty alternator — not charging the battery under load.',
        parts: [{ label: 'Alternator (OEM)', quantity: 1, unitPrice: 350 }],
        labour: 150,
      };
    case 'Plumbing':
      return {
        diagnosis: 'Cracked feed pipe under the sink causing the leak.',
        parts: [
          { label: 'Copper pipe section', quantity: 2, unitPrice: 28 },
          { label: 'Compression fittings', quantity: 4, unitPrice: 9 },
        ],
        labour: 120,
      };
    case 'HVAC':
      return {
        diagnosis: 'Compressor capacitor failed; refrigerant charge is low.',
        parts: [
          { label: 'Run capacitor 45uF', quantity: 1, unitPrice: 65 },
          { label: 'Refrigerant recharge', quantity: 1, unitPrice: 140 },
        ],
        labour: 160,
      };
    case 'Appliance Repair':
      return {
        diagnosis: 'Drain pump seized and the door seal is perished.',
        parts: [
          { label: 'Drain pump assembly', quantity: 1, unitPrice: 95 },
          { label: 'Door seal', quantity: 1, unitPrice: 42 },
        ],
        labour: 110,
      };
    default:
      return {
        diagnosis: 'Burnt outlet terminal and damaged wiring on the kitchen circuit.',
        parts: [
          { label: 'Double socket outlet', quantity: 1, unitPrice: 24 },
          { label: '2.5mm cable (per metre)', quantity: 6, unitPrice: 6 },
        ],
        labour: 150,
      };
  }
}

/** Extra work discovered mid-repair. Never charged without approval. */
export function buildAdditionalWork(service: string): AdditionalWork {
  switch (service) {
    case 'Car & Garage':
    case 'Truck & Mechanical':
      return {
        reason: 'The drive belt is cracked and will fail within weeks if left on the new alternator.',
        parts: [{ label: 'Serpentine drive belt', quantity: 1, unitPrice: 60 }],
        labour: 40,
      };
    case 'Plumbing':
      return {
        reason: 'The shut-off valve behind the wall is seized and cannot hold pressure.',
        parts: [{ label: 'Quarter-turn shut-off valve', quantity: 1, unitPrice: 35 }],
        labour: 45,
      };
    default:
      return {
        reason: 'The circuit breaker feeding this outlet is scorched and no longer trips reliably.',
        parts: [{ label: '20A circuit breaker', quantity: 1, unitPrice: 38 }],
        labour: 50,
      };
  }
}

/**
 * How long each automatic stage runs before the job advances on its own.
 * Statuses absent from this map wait for the customer to act.
 */
export const AUTO_ADVANCE_MS: Partial<Record<JobStatus, number>> = {
  REQUESTED: 1500,
  MATCHING: 5000,
  VISIT_PAID: 2500,
  EN_ROUTE: 14000,
  ARRIVED: 4000,
  DIAGNOSING: 7000,
  DIAGNOSIS_COMPLETE: 2000,
  QUOTE_APPROVED: 2000,
  REPAIR_IN_PROGRESS: 10000,
  PAYMENT_REPORTED: 1500,
};

/**
 * The next status a timer moves the job to.
 *
 * Every key in AUTO_ADVANCE_MS must appear here or its stage never advances.
 * REPAIR_IN_PROGRESS is the one fork: this is where it lands once the extra
 * work has been offered, and the provider redirects the first pass to
 * ADDITIONAL_APPROVAL_REQUIRED instead.
 */
export const AUTO_NEXT: Partial<Record<JobStatus, JobStatus>> = {
  REQUESTED: 'MATCHING',
  MATCHING: 'OFFERED',
  VISIT_PAID: 'EN_ROUTE',
  EN_ROUTE: 'ARRIVED',
  ARRIVED: 'DIAGNOSING',
  DIAGNOSING: 'DIAGNOSIS_COMPLETE',
  DIAGNOSIS_COMPLETE: 'QUOTE_PENDING',
  QUOTE_APPROVED: 'REPAIR_IN_PROGRESS',
  REPAIR_IN_PROGRESS: 'REPAIR_COMPLETED',
  PAYMENT_REPORTED: 'COMPLETED',
};

/** Simulated travel time, so the tracking screen can count down. */
export const EN_ROUTE_MS = AUTO_ADVANCE_MS.EN_ROUTE ?? 14000;

/**
 * Stages a real technician drives by hand once they have taken the job.
 *
 * Without a technician these advance on a timer so the customer journey still
 * demonstrates end to end. The moment someone takes the job on this device,
 * the timers step aside and the buttons in the work dashboard take over.
 */
export const TECHNICIAN_DRIVEN: JobStatus[] = ['EN_ROUTE', 'ARRIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS'];
export const REPAIR_MS = AUTO_ADVANCE_MS.REPAIR_IN_PROGRESS ?? 10000;

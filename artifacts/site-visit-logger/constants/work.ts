/** Technician profile and availability types shared by work screens. */

/**
 * Nobody is hired on their word alone. A technician registers under a trade and
 * proves it: a national ID, and at least one certificate for the trade claimed.
 * Until that is reviewed they cannot go online, so customers only ever reach
 * technicians whose papers someone has actually read.
 */
export const TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Appliance Repair',
  'Car & Garage',
  'Truck & Mechanical',
  'Home Repair',
  'General Maintenance',
] as const;

export type Trade = string;

/** These states come from the backend verification status. */
export type WorkStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type WorkProfile = {
  id?: string;
  trade: Trade;
  yearsExperience: number;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  gender?: 'FEMALE' | 'MALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
  nationalIdNumber?: string;
  baseAddress?: string;
  baseLatitude?: number;
  baseLongitude?: number;
  paymentMethod?: 'MOMO' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  paymentNumber?: string;
  profilePictureUri?: string;
  profilePictureUrl?: string | null;
  idPhotoUri: string;
  certificateUris: string[];
  serviceExperiences?: Array<{ trade: string; customName: string; yearsOfExperience: number }>;
  documents?: Array<{
    id: string;
    type: 'NATIONAL_ID' | 'CERTIFICATE';
    title: string;
    originalFileName: string;
    status: string;
    createdAt: string;
    reviewNote: string | null;
  }>;
  submittedAt: string;
};

export type TechnicianApplication = Omit<WorkProfile, 'submittedAt' | 'documents'>;

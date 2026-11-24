/** Technician profile and availability types shared by work screens. */

/**
 * Nobody is hired on their word alone. A technician registers under a trade and
 * proves it: a national ID, and at least one certificate for the trade claimed.
 * Until that is reviewed they cannot go online, so customers only ever reach
 * technicians whose papers someone has actually read.
 */
export type Trade = string;

/** These states come from the backend verification status. */
export type WorkStatus =
  | 'none'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export function isWorkPending(status: WorkStatus): boolean {
  return status === 'pending' || status === 'PENDING_REVIEW';
}

export function isWorkVerified(status: WorkStatus): boolean {
  return status === 'verified' || status === 'APPROVED';
}

export function isWorkRejected(status: WorkStatus): boolean {
  return status === 'rejected' || status === 'REJECTED';
}

export type ServiceExperienceStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'SUSPENDED';

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
  profilePictureMimeType?: string;
  profilePictureSizeBytes?: number;
  idPhotoUri: string;
  idPhotoMimeType?: string;
  idPhotoSizeBytes?: number;
  certificateUris: string[];
  certificateMimeTypes?: Array<string | undefined>;
  certificateSizeBytes?: Array<number | undefined>;
  serviceExperiences?: Array<{
    id?: string;
    /** The catalog service; null for a trade the technician named themselves ("Others"). */
    categoryId?: string | null;
    trade: string;
    customName: string;
    yearsOfExperience: number;
    status?: ServiceExperienceStatus;
    reviewNote?: string | null;
  }>;
  documents?: Array<{
    id: string;
    type: 'NATIONAL_ID' | 'CERTIFICATE';
    title: string;
    originalFileName?: string;
    status: string;
    createdAt?: string;
    reviewNote: string | null;
  }>;
  submittedAt: string;
  rejectionFeedback?: string | null;
  /** Working alone or as a registered company (which an admin reviews separately). */
  businessType?: 'INDIVIDUAL' | 'COMPANY';
  /** The company's details, when applying as a company. */
  company?: {
    name: string;
    location: string;
    email: string;
    phoneNumber: string;
    description: string;
  };
};

export type TechnicianApplication = Omit<WorkProfile, 'submittedAt' | 'documents'>;
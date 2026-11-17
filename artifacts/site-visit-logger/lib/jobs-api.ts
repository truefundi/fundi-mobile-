import { Platform } from 'react-native';
import { apiRequest, apiUpload } from '@/lib/api';
import { resolveRequestMediaUri } from '@/lib/requestMedia';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import type { RequestType } from '@/constants/jobs';

export interface BackendJobMedia {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'VOICE_NOTE' | 'DOCUMENT';
  url: string;
  createdAt: string;
}

export interface BackendServiceCategory {
  id: string;
  name: string;
  slug: string;
  bookingFee?: number;
  sosBookingFee?: number | null;
}

export interface BackendTechnicianProfile {
  id: string;
  fullName: string;
  profile?: {
    gender?: string;
    yearsOfExperience?: number;
    publicLocationLabel?: string;
    profilePictureUrl?: string | null;
    serviceExperiences?: Array<{
      categoryId?: string | null;
      category?: BackendServiceCategory | null;
      customName?: string | null;
      yearsOfExperience?: number;
    }>;
  };
}

export interface BackendBookingPayment {
  id: string;
  externalPaymentId: string;
  requestType: 'NORMAL' | 'SOS';
  serviceCategory?: BackendServiceCategory | null;
  amount: number;
  currency: string;
  status: 'VALID' | 'EXPIRED' | 'CONSUMED' | 'RESUMED';
  paidAt: string;
  validUntil: string;
  remainingValiditySeconds?: number;
}

/** Which technician a client's request was routed to, before anyone is assigned. */
export interface BackendRequestRouting {
  id: string;
  status?: 'OFFERED' | 'REJECTED' | 'EXPIRED';
  technicianId: string;
  technicianName: string;
  technicianProfilePictureUrl?: string | null;
  distanceMeters?: number;
  expiresAt?: string | null;
  respondedAt?: string | null;
}

export interface BackendJob {
  id: string;
  service: string;
  serviceCategory?: BackendServiceCategory | null;
  otherServiceName?: string | null;
  description: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  offeredAmount: number;
  currency: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  requestType: 'NORMAL' | 'SOS';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PAUSED' | 'FAILED';
  cooperationStatus: 'PENDING' | 'CONFIRMED';
  cooperationConfirmations: {
    customerConfirmedAt: string | null;
    technicianConfirmedAt: string | null;
  };
  dispatchStatus: 'PENDING' | 'OFFERED' | 'EXHAUSTED';
  /** Customer view of an open job: the technician the request is waiting on. */
  activeOffer?: BackendRequestRouting | null;
  /** Customer view of an open job with nothing pending: who last declined or let it expire. */
  lastOffer?: BackendRequestRouting | null;
  currentTechnician?: BackendTechnicianProfile | null;
  bookingPayment?: BackendBookingPayment | null;
  customerProgress: 'PENDING' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  technicianProgress: 'PENDING' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  media?: BackendJobMedia[];
  createdAt: string;
  updatedAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
}

export interface MatchingTechnicianItem {
  technicianId: string;
  fullName: string;
  matchAccuracy: number;
  distanceMeters: number | null;
  gender?: string;
  yearsOfExperience: number;
  serviceExperiences: Array<{
    categoryId?: string | null;
    category?: { id: string; name: string; slug: string } | null;
    customName?: string | null;
    yearsOfExperience?: number;
  }>;
  publicLocationLabel?: string;
  matchedLocations?: string[];
  profilePictureUrl?: string | null;
  avatarUrl?: string | null;
}

export interface GeocodedLocation {
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface TechnicianOfferItem {
  id: string;
  matchScore: number;
  distanceMeters: number;
  round: number;
  status: 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'DROPPED' | 'CANCELLED';
  expiresAt?: string;
  offeredAt?: string;
  respondedAt?: string | null;
  rejectionReason?: string | null;
  /** The requesting client, when the backend includes it (older backends omit it). */
  customer?: { id: string; fullName: string; profilePictureUrl?: string | null } | null;
  job: {
    id: string;
    service: string;
    description: string;
    locationAddress: string;
    latitude: number;
    longitude: number;
    offeredAmount: number;
    currency: string;
    priority: string;
    status: string;
    createdAt: string;
    media: BackendJobMedia[];
  };
}

export interface PhoneVerificationRequestResponse {
  verificationId: string;
  expiresAt: string;
  message: string;
}

export interface VerifyPhoneResponse {
  verificationId: string;
  verified: boolean;
  verifiedAt: string;
}

export interface CreateBookingPaymentResponse {
  id: string;
  externalPaymentId: string;
  status: 'SUCCESS';
  bookingStatus: 'VALID';
  serviceCategory: BackendServiceCategory;
  requestType: 'NORMAL' | 'SOS';
  phoneNumber: string;
  amount: number;
  currency: string;
  paidAt: string;
  validUntil: string;
}

export interface CreateJobInput {
  paymentId: string;
  /** Omit when the account phone number is already verified. */
  phoneVerificationId?: string;
  serviceCategoryId: string;
  description: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  /** Optional budget. The price is normally agreed later in the chat. */
  offeredAmount?: number;
  requestType?: 'NORMAL' | 'SOS';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  photos?: Array<{ uri: string; name?: string; mimeType?: string }>;
  video?: { uri: string; name?: string; mimeType?: string };
}

// ─── Customer Phone Verification ──────────────────────────────────────────

export type JobPhoneStatus = { phoneNumber: string; verified: boolean; verifiedAt: string | null };

/** Whether the account phone is verified, in which case a job needs no per-job code. */
export async function fetchJobPhoneStatus(): Promise<JobPhoneStatus> {
  return apiRequest<JobPhoneStatus>('/api/v1/jobs/phone-verification/status', {
    authenticated: true,
  });
}

export async function requestJobPhoneVerification(phoneNumber?: string): Promise<PhoneVerificationRequestResponse> {
  const normalizedPhone = phoneNumber ? cleanAndNormalizePhone(phoneNumber) : undefined;
  return apiRequest<PhoneVerificationRequestResponse>('/api/v1/jobs/phone-verification/request', {
    method: 'POST',
    authenticated: true,
    ...(normalizedPhone ? { body: { phoneNumber: normalizedPhone } } : {}),
  });
}

export async function verifyJobPhone(verificationId: string, otp: string): Promise<VerifyPhoneResponse> {
  return apiRequest<VerifyPhoneResponse>('/api/v1/jobs/phone-verification/verify', {
    method: 'POST',
    authenticated: true,
    body: { verificationId, otp },
  });
}

// ─── Booking Payments ─────────────────────────────────────────────────────

export async function createBookingPayment(
  serviceCategoryId: string,
  requestType: 'NORMAL' | 'SOS' = 'NORMAL',
  phoneNumber?: string,
): Promise<CreateBookingPaymentResponse> {
  return apiRequest<CreateBookingPaymentResponse>('/api/v1/payments/mock', {
    method: 'POST',
    authenticated: true,
    body: {
      serviceCategoryId,
      requestType,
      ...(phoneNumber ? { phoneNumber } : {}),
    },
  });
}

// ─── Job Creation & Customer Management ───────────────────────────────────

/**
 * Adds a local file to a multipart body. Native takes the `{ uri, name, type }`
 * descriptor; the browser needs the bytes, so saved web attachments are read
 * back as a Blob first.
 */
async function appendUploadFile(
  formData: FormData,
  field: string,
  file: { uri: string; name: string; type: string },
): Promise<void> {
  if (Platform.OS !== 'web') {
    formData.append(field, file as any);
    return;
  }
  const resolved = await resolveRequestMediaUri(file.uri);
  const response = await fetch(resolved);
  if (!response.ok) throw new Error('An attachment could not be read. Remove it and attach it again.');
  const blob = await response.blob();
  formData.append(field, blob, file.name);
}

export async function createCustomerJob(input: CreateJobInput): Promise<BackendJob> {
  const isSos = input.requestType === 'SOS';
  const path = isSos ? '/api/v1/jobs/sos' : '/api/v1/jobs';

  const formData = new FormData();
  formData.append('paymentId', input.paymentId);
  if (input.phoneVerificationId) {
    formData.append('phoneVerificationId', input.phoneVerificationId);
  }
  formData.append('serviceCategoryId', input.serviceCategoryId);
  formData.append('description', input.description);
  formData.append('locationAddress', input.locationAddress);
  formData.append('latitude', String(input.latitude));
  formData.append('longitude', String(input.longitude));
  if (input.offeredAmount !== undefined) {
    formData.append('offeredAmount', String(input.offeredAmount));
  }
  formData.append('requestType', input.requestType || 'NORMAL');
  if (input.priority) {
    formData.append('priority', input.priority);
  }

  for (const [idx, photo] of (input.photos ?? []).entries()) {
    await appendUploadFile(formData, 'photos', {
      uri: photo.uri,
      name: photo.name || `photo_${idx}.jpg`,
      type: photo.mimeType || 'image/jpeg',
    });
  }

  if (input.video?.uri) {
    await appendUploadFile(formData, 'video', {
      uri: input.video.uri,
      name: input.video.name || 'video.mp4',
      type: input.video.mimeType || 'video/mp4',
    });
  }

  return apiUpload<BackendJob>(path, formData);
}

export async function fetchCustomerJobs(): Promise<BackendJob[]> {
  return apiRequest<BackendJob[]>('/api/v1/jobs/mine', {
    authenticated: true,
  });
}

export async function fetchCustomerJob(jobId: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/mine/${jobId}`, {
    authenticated: true,
  });
}

export async function previewMatchingTechnicians(
  serviceCategoryId: string,
  latitude: number,
  longitude: number,
): Promise<MatchingTechnicianItem[]> {
  const query = new URLSearchParams({
    serviceCategoryId,
    latitude: String(latitude),
    longitude: String(longitude),
  });
  return apiRequest<MatchingTechnicianItem[]>(`/api/v1/jobs/matching-technicians?${query.toString()}`, {
    authenticated: true,
  });
}

export async function geocodeLocation(location: string): Promise<GeocodedLocation> {
  return apiRequest<GeocodedLocation>('/api/v1/jobs/geocode-location', {
    method: 'POST',
    authenticated: true,
    body: { location },
  });
}

/**
 * Sends an unanswered request on to the best eligible technician who has not
 * been asked about this job yet (backend auto-routing).
 */
export async function retryJobDispatch(jobId: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/mine/${jobId}/retry-dispatch`, {
    method: 'POST',
    authenticated: true,
  });
}

export async function proposeTechnician(jobId: string, technicianId: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/mine/${jobId}/requests`, {
    method: 'POST',
    authenticated: true,
    body: { technicianId },
  });
}

export async function cancelCustomerJob(jobId: string, reason: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/mine/${jobId}/cancel`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

// ─── Cooperation & Progress ────────────────────────────────────────────────

export async function confirmJobCooperation(jobId: string, role: 'customer' | 'technician' = 'customer'): Promise<BackendJob> {
  const path = role === 'technician'
    ? `/api/v1/jobs/technician/mine/${jobId}/confirm-cooperation`
    : `/api/v1/jobs/mine/${jobId}/confirm-cooperation`;

  return apiRequest<BackendJob>(path, {
    method: 'POST',
    authenticated: true,
  });
}

export async function updateJobProgress(
  jobId: string,
  status: 'PENDING' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
  role: 'customer' | 'technician' = 'customer',
): Promise<BackendJob> {
  const path = role === 'technician'
    ? `/api/v1/jobs/technician/mine/${jobId}/progress`
    : `/api/v1/jobs/mine/${jobId}/progress`;

  return apiRequest<BackendJob>(path, {
    method: 'PATCH',
    authenticated: true,
    body: { status },
  });
}

// ─── Technician Jobs & Offers ─────────────────────────────────────────────

export async function fetchTechnicianOffers(): Promise<TechnicianOfferItem[]> {
  return apiRequest<TechnicianOfferItem[]>('/api/v1/jobs/technician/offers', {
    authenticated: true,
  });
}

export async function acceptTechnicianOffer(offerId: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/technician/offers/${offerId}/accept`, {
    method: 'POST',
    authenticated: true,
  });
}

export async function rejectTechnicianOffer(offerId: string, reason?: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/v1/jobs/technician/offers/${offerId}/reject`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

export async function fetchTechnicianJobs(): Promise<BackendJob[]> {
  return apiRequest<BackendJob[]>('/api/v1/jobs/technician/mine', {
    authenticated: true,
  });
}

export async function fetchTechnicianJob(jobId: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/technician/mine/${jobId}`, {
    authenticated: true,
  });
}

export async function dropTechnicianJob(jobId: string, reason: string): Promise<BackendJob> {
  return apiRequest<BackendJob>(`/api/v1/jobs/technician/mine/${jobId}/drop`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

import { Platform } from 'react-native';
import { apiRequest, apiUpload } from '@/lib/api';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';

export type TechnicianServiceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** GET /api/v1/technicians/profile/services: one service and where its review stands. */
export interface TechnicianService {
  id: string;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  customName: string | null;
  yearsOfExperience: number;
  status: TechnicianServiceStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const BASE = '/api/v1/technicians/profile/services';

export function serviceName(service: Pick<TechnicianService, 'category' | 'customName'>): string {
  return service.category?.name ?? service.customName ?? 'Service';
}

export async function fetchMyServices(): Promise<TechnicianService[]> {
  return apiRequest<TechnicianService[]>(BASE, { authenticated: true });
}

/** Applies to offer another service; it waits for review. */
export async function addMyService(input: {
  categoryId?: string;
  customName?: string;
  yearsOfExperience: number;
}): Promise<TechnicianService> {
  return apiRequest<TechnicianService>(BASE, { method: 'POST', authenticated: true, body: input });
}

/** Changes a pending service, or sends a rejected one back for review. */
export async function updateMyService(id: string, input: { yearsOfExperience?: number }): Promise<TechnicianService> {
  return apiRequest<TechnicianService>(`${BASE}/${id}`, { method: 'PATCH', authenticated: true, body: input });
}

export async function withdrawMyService(id: string): Promise<void> {
  await apiRequest(`${BASE}/${id}`, { method: 'DELETE', authenticated: true });
}

export const CERTIFICATE_TYPES = [
  { value: 'TVET_CERTIFICATE', label: 'TVET certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'DEGREE', label: 'Degree' },
  { value: 'SHORT_COURSE', label: 'Short course' },
  { value: 'OTHER', label: 'Other' },
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number]['value'];

export type PickedFile = { uri: string; name?: string; size?: number; mimeType?: string };

/** Problems with a chosen certificate, or null when it can be sent. */
export function certificateIssue(file: PickedFile): string | null {
  if (file.size === undefined || !Number.isFinite(file.size)) return 'Choose the file again so its size can be checked.';
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return `The certificate must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`;
  const type = inferUploadMimeType(file.uri, file.mimeType);
  if (!type?.startsWith('image/') && type !== 'application/pdf') return 'Choose a photo or PDF of the certificate.';
  return null;
}

/** Files a certificate for a service (POST /technicians/profile/documents). */
export async function uploadServiceCertificate(
  service: Pick<TechnicianService, 'categoryId' | 'customName' | 'category'>,
  file: PickedFile,
  certificateType: CertificateType,
): Promise<void> {
  const mimeType = inferUploadMimeType(file.uri, file.mimeType) ?? 'application/octet-stream';
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'img';
  const name = serviceName(service);
  const form = new FormData();
  form.append('type', 'CERTIFICATE');
  // Titles are unique per technician; the date keeps a later certificate for the same service distinct.
  form.append('title', `${name} certificate ${new Date().toISOString().slice(0, 10)}`);
  form.append('certificateType', certificateType);
  if (service.categoryId) form.append('categoryId', service.categoryId);
  else form.append('customCategoryName', name);
  const fileName = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-certificate.${extension}`;
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    if (!response.ok) throw new Error('Could not read the selected certificate.');
    form.append('file', await response.blob(), fileName);
  } else {
    form.append('file', {
      uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }
  await apiUpload('/api/v1/technicians/profile/documents', form, 'POST');
}

/** A certificate the technician already filed, and the services it covers. */
export type MyCertificate = {
  id: string;
  title: string;
  certificateType: CertificateType | null;
  status: 'SUBMITTED' | 'REVIEWING' | 'ACCEPTED' | 'DENIED';
  serviceCategories: Array<{ id: string; name: string }>;
};

/** The technician's own certificates (not the national ID). */
export async function fetchMyCertificates(): Promise<MyCertificate[]> {
  const documents = await apiRequest<Array<MyCertificate & { type: string }>>('/api/v1/technicians/profile/documents', {
    authenticated: true,
  });
  return documents.filter((document) => document.type === 'CERTIFICATE');
}

/** Links a certificate already on file to another catalog service, instead of uploading it again. */
export async function reuseCertificate(documentId: string, categoryId: string): Promise<void> {
  await apiRequest(`/api/v1/technicians/profile/documents/${documentId}/services`, {
    method: 'POST',
    authenticated: true,
    body: { categoryId },
  });
}

export function certificateTypeLabel(type: CertificateType | null): string {
  return CERTIFICATE_TYPES.find((option) => option.value === type)?.label ?? 'Certificate';
}

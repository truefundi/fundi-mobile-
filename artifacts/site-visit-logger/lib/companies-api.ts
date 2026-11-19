import { apiRequest, ApiRequestError } from '@/lib/api';
import { cleanAndNormalizePhone } from '@/lib/auth-api';

export type BusinessType = 'INDIVIDUAL' | 'COMPANY';

/** Company details as the client types them. */
export type CompanyDraft = {
  name: string;
  location: string;
  email: string;
  phoneNumber: string;
  description: string;
};

export const EMPTY_COMPANY: CompanyDraft = { name: '', location: '', email: '', phoneNumber: '', description: '' };

/** GET /api/v1/companies/mine: the company a technician registered. */
export interface MyCompany {
  id: string;
  name: string;
  location: string;
  email: string;
  phoneNumber: string;
  description: string | null;
  /** An admin reviews every company; details can only change until it is approved. */
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** The admin's reason when the company was rejected. */
  rejectionReason?: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const RWANDA_PHONE = /^\+250(72|73|78|79)\d{7}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problems the API would refuse, by field ('' when the field is fine). */
export function companyIssues(draft: CompanyDraft): Partial<Record<keyof CompanyDraft, string>> {
  const issues: Partial<Record<keyof CompanyDraft, string>> = {};
  const name = draft.name.trim();
  const location = draft.location.trim();
  const email = draft.email.trim();
  if (name.length < 2) issues.name = 'Enter the company name.';
  else if (name.length > 160) issues.name = 'Use at most 160 characters.';
  if (location.length < 2) issues.location = 'Enter where the company is based.';
  else if (location.length > 255) issues.location = 'Use at most 255 characters.';
  if (!email) issues.email = 'Enter the company email.';
  else if (!EMAIL.test(email) || email.length > 254) issues.email = 'Enter a valid email address.';
  if (!RWANDA_PHONE.test(cleanAndNormalizePhone(draft.phoneNumber.trim())))
    issues.phoneNumber = 'Enter a Rwandan number: 078, 079, 072 or 073 and seven digits.';
  if (draft.description.trim().length > 2000) issues.description = 'Use at most 2000 characters.';
  return issues;
}

/** The body the API takes for company details. */
export function companyBody(draft: CompanyDraft) {
  const description = draft.description.trim();
  return {
    name: draft.name.trim(),
    location: draft.location.trim(),
    email: draft.email.trim().toLowerCase(),
    phoneNumber: cleanAndNormalizePhone(draft.phoneNumber.trim()),
    ...(description ? { description } : {}),
  };
}

export function draftFromCompany(company: MyCompany): CompanyDraft {
  return {
    name: company.name,
    location: company.location,
    email: company.email,
    phoneNumber: company.phoneNumber,
    description: company.description ?? '',
  };
}

/** The signed-in technician's company, or null when they registered as an individual. */
export async function fetchMyCompany(): Promise<MyCompany | null> {
  try {
    return await apiRequest<MyCompany>('/api/v1/companies/mine', { authenticated: true });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

/** Changes company details; the company goes back to review. Refused once approved. */
export async function updateMyCompany(draft: CompanyDraft): Promise<MyCompany> {
  return apiRequest<MyCompany>('/api/v1/companies/mine', {
    method: 'PATCH',
    authenticated: true,
    body: companyBody(draft),
  });
}

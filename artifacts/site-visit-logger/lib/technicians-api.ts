import { apiRequest } from '@/lib/api';
import type { MarketplaceTechnician } from '@/constants/technicians';

export interface BackendTechnicianCategory {
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  customName?: string | null;
  yearsOfExperience: number;
}

export interface BackendPublicTechnician {
  id: string;
  user: {
    id: string;
    fullName: string;
    role?: string;
    phoneNumber?: string | null;
  };
  gender?: string | null;
  yearsOfExperience: number;
  serviceExperiences: BackendTechnicianCategory[];
  verificationStatus: string;
  availabilityStatus: 'ONLINE' | 'OFFLINE';
  location?: {
    address?: string | null;
    publicLocationLabel?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  profilePictureUrl?: string | null;
  createdAt: string;
}

export interface PaginatedPublicTechnicians {
  data: BackendPublicTechnician[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function mapBackendTechnicianToMarketplace(tech: BackendPublicTechnician): MarketplaceTechnician {
  const serviceList = tech.serviceExperiences.map(
    (exp) => exp.category?.name || exp.customName || 'General Maintenance',
  );
  const primaryService = serviceList[0] || 'General Maintenance';

  return {
    id: tech.id,
    name: tech.user.fullName,
    service: primaryService,
    services: serviceList.length > 0 ? serviceList : [primaryService],
    rating: 4.8,
    reviewsCount: 15,
    jobsCompleted: 24,
    etaMinutes: 15,
    yearsExperience: tech.yearsOfExperience || 1,
    location: {
      latitude: tech.location?.latitude ?? -1.9448,
      longitude: tech.location?.longitude ?? 30.0619,
    },
    isAvailable: tech.availabilityStatus === 'ONLINE',
    phoneNumber: tech.user.phoneNumber || '',
    avatarUrl: tech.profilePictureUrl || undefined,
  };
}

export async function fetchPublicTechnicians(query?: {
  categoryId?: string;
  search?: string;
  limit?: number;
  page?: number;
}): Promise<MarketplaceTechnician[]> {
  const params = new URLSearchParams();
  if (query?.categoryId) params.append('categoryId', query.categoryId);
  if (query?.search) params.append('search', query.search);
  if (query?.limit) params.append('limit', String(query.limit));
  if (query?.page) params.append('page', String(query.page));

  const url = `/api/v1/public/technicians${params.toString() ? `?${params.toString()}` : ''}`;
  try {
    const res = await apiRequest<PaginatedPublicTechnicians | BackendPublicTechnician[]>(url);
    const list = Array.isArray(res) ? res : res.data ?? [];
    return list.map(mapBackendTechnicianToMarketplace);
  } catch {
    return [];
  }
}

export async function fetchPublicTechnicianById(id: string): Promise<MarketplaceTechnician | null> {
  // 1. Try public endpoint first
  try {
    const res = await apiRequest<BackendPublicTechnician>(`/api/v1/public/technicians/${id}`);
    if (res && res.id) {
      return mapBackendTechnicianToMarketplace(res);
    }
  } catch {}

  // 2. Try authenticated approved endpoint (allows approved tech even if offline)
  try {
    const resAuth = await apiRequest<BackendPublicTechnician>(`/api/v1/technicians/approved/${id}`, {
      authenticated: true,
    });
    if (resAuth && resAuth.id) {
      return mapBackendTechnicianToMarketplace(resAuth);
    }
  } catch {}

  // 3. Fallback: Search in available list
  try {
    const list = await fetchPublicTechnicians();
    const found = list.find((t) => t.id === id);
    if (found) return found;
  } catch {}

  return null;
}

export async function fetchAvailableTechnicians(query?: {
  categoryId?: string;
  search?: string;
}): Promise<MarketplaceTechnician[]> {
  const params = new URLSearchParams();
  if (query?.categoryId) params.append('categoryId', query.categoryId);
  if (query?.search) params.append('search', query.search);

  const url = `/api/v1/technicians${params.toString() ? `?${params.toString()}` : ''}`;
  try {
    const res = await apiRequest<PaginatedPublicTechnicians | BackendPublicTechnician[]>(url, {
      authenticated: true,
    });
    const list = Array.isArray(res) ? res : res.data ?? [];
    return list.map(mapBackendTechnicianToMarketplace);
  } catch {
    return [];
  }
}

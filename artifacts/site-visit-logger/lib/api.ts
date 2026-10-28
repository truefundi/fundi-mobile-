import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { Platform } from 'react-native';
import { getAccessToken } from '@/lib/auth-session';

let configured = false;

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  authenticated?: boolean;
  body?: unknown;
};

const MOCK_CURRENT_USER_KEY = 'fundi.mock-auth-current-user';
const MOCK_TECH_PROFILES_KEY = 'fundi.mock-tech-profiles-store';

async function getCurrentUserFromStorage(): Promise<{ phoneNumber: string; fullName: string; role: string } | null> {
  try {
    const raw = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage.getItem(MOCK_CURRENT_USER_KEY)
      : await AsyncStorage.getItem(MOCK_CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function getStoredTechProfiles(): Promise<Record<string, { profile: any; documents: any[] }>> {
  try {
    const raw = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage.getItem(MOCK_TECH_PROFILES_KEY)
      : await AsyncStorage.getItem(MOCK_TECH_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveStoredTechProfiles(data: Record<string, { profile: any; documents: any[] }>): Promise<void> {
  const serialized = JSON.stringify(data);
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(MOCK_TECH_PROFILES_KEY, serialized);
    }
    await AsyncStorage.setItem(MOCK_TECH_PROFILES_KEY, serialized);
  } catch {}
}

/** Configure generated API requests once for the current Expo bundle. */
export function configureApi(): void {
  if (configured) return;

  setBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? null);
  setAuthTokenGetter(getAccessToken);
  configured = true;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  // --- OFFLINE/FRONTEND MOCK INTERCEPTOR ---
  if (path.includes('/api/v1/technicians')) {
    const currentUser = await getCurrentUserFromStorage();

    if (path.includes('/availability')) {
      const body = options.body as any;
      if (currentUser) {
        const store = await getStoredTechProfiles();
        if (store[currentUser.phoneNumber]?.profile) {
          store[currentUser.phoneNumber].profile.availabilityStatus = body?.availabilityStatus ?? 'ONLINE';
          await saveStoredTechProfiles(store);
          return store[currentUser.phoneNumber].profile as unknown as T;
        }
      }
      return {
        id: 'mock-tech-id-1',
        verificationStatus: 'APPROVED',
        availabilityStatus: body?.availabilityStatus ?? 'ONLINE',
      } as unknown as T;
    }

    if (path.includes('/profile/documents')) {
      if (options.method === 'DELETE') {
        if (currentUser) {
          const docId = path.split('/').pop();
          const store = await getStoredTechProfiles();
          if (store[currentUser.phoneNumber]) {
            store[currentUser.phoneNumber].documents = (store[currentUser.phoneNumber].documents ?? []).filter(
              (d) => d.id !== docId,
            );
            await saveStoredTechProfiles(store);
          }
        }
        return { message: 'Document deleted successfully' } as unknown as T;
      }
      if (currentUser) {
        const store = await getStoredTechProfiles();
        const userTech = store[currentUser.phoneNumber];
        return (userTech?.documents ?? []) as unknown as T;
      }
      return [] as unknown as T;
    }

    if (path.includes('/profile')) {
      const method = options.method?.toUpperCase() ?? 'GET';

      if (method === 'POST' || method === 'PUT') {
        const body = options.body as any;
        const phone = body?.phoneNumber || currentUser?.phoneNumber;
        if (!phone) throw new ApiRequestError('Phone number required', 400);

        const store = await getStoredTechProfiles();
        const existingDocs = store[phone]?.documents ?? [];
        const techProfile = {
          id: store[phone]?.profile?.id ?? `tech-${Date.now()}`,
          user: {
            fullName: body.fullName || currentUser?.fullName || '',
            phoneNumber: phone,
            email: body.email ?? null,
          },
          gender: body.gender ?? 'MALE',
          yearsOfExperience: body.yearsExperience ?? 1,
          serviceExperiences: (body.serviceExperiences || []).map((exp: any, i: number) => ({
            id: `exp-${i}`,
            customName: exp.customName,
            category: { name: exp.customName },
            yearsOfExperience: exp.yearsOfExperience,
            status: 'APPROVED',
          })),
          verificationStatus: 'APPROVED',
          availabilityStatus: 'ONLINE',
          location: {
            address: body.baseAddress || 'Kigali, Rwanda',
            latitude: body.baseLatitude ?? -1.9441,
            longitude: body.baseLongitude ?? 30.0619,
          },
          profilePictureUrl: null,
          nationalIdNumber: body.nationalIdNumber,
          paymentMethod: body.paymentMethod ?? 'MOMO',
          paymentNumber: body.paymentNumber ?? phone,
          createdAt: store[phone]?.profile?.createdAt ?? new Date().toISOString(),
        };

        store[phone] = {
          profile: techProfile,
          documents: existingDocs,
        };
        await saveStoredTechProfiles(store);
        return techProfile as unknown as T;
      }

      // GET method: Only return a profile if the user has actually submitted an application!
      if (!currentUser) {
        throw new ApiRequestError('Technician profile not found.', 404);
      }

      const store = await getStoredTechProfiles();
      const userTech = store[currentUser.phoneNumber];

      if (!userTech || !userTech.profile) {
        throw new ApiRequestError('Technician profile not found.', 404);
      }

      return userTech.profile as unknown as T;
    }
  }

  if (path.includes('/api/v1/health')) {
    return { services: { api: 'up' } } as unknown as T;
  }
  // ----------------------------------------

  configureApi();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL before making an API request.');

  const { authenticated = false, body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  if (body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (authenticated) {
    const token = await getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message = payload?.message;
    throw new ApiRequestError(
      Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : `Request failed (${response.status}).`,
      response.status,
    );
  }

  return data as T;
}

/** Uploads multipart form data without setting Content-Type manually. */
export async function apiUpload<T>(path: string, body: FormData, method = 'POST'): Promise<T> {
  // --- MOCK UPLOAD INTERCEPTOR ---
  if (path.includes('/api/v1/technicians')) {
    const currentUser = await getCurrentUserFromStorage();
    if (path.includes('/picture')) {
      return {
        profilePictureUrl: 'https://placehold.co/400x400/png',
      } as unknown as T;
    }
    if (path.includes('/documents')) {
      const docType = (body as any)?._parts?.find((p: any) => p[0] === 'type')?.[1] || 'NATIONAL_ID';
      const docTitle = (body as any)?._parts?.find((p: any) => p[0] === 'title')?.[1] || 'National ID';
      const newDoc = {
        id: 'doc-mock-' + Date.now(),
        type: docType,
        title: docTitle,
        status: 'APPROVED',
      };
      if (currentUser) {
        const store = await getStoredTechProfiles();
        if (store[currentUser.phoneNumber]) {
          store[currentUser.phoneNumber].documents = [
            ...(store[currentUser.phoneNumber].documents ?? []).filter((d) => d.type !== docType),
            newDoc,
          ];
          await saveStoredTechProfiles(store);
        }
      }
      return newDoc as unknown as T;
    }
  }
  // -------------------------------

  configureApi();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL before making an API request.');

  const headers = new Headers();
  const token = await getAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  if (Platform.OS !== 'web') {
    return new Promise<T>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, `${baseUrl}${path}`);
      headers.forEach((value, key) => request.setRequestHeader(key, value));
      request.onload = () => {
        const text = request.responseText;
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        if (request.status < 200 || request.status >= 300) {
          const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
          const message = payload?.message;
          reject(new ApiRequestError(
            Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : `Request failed (${request.status}).`,
            request.status,
          ));
          return;
        }
        resolve(data as T);
      };
      request.onerror = () => reject(new Error('Network error while uploading form data.'));
      request.onabort = () => reject(new Error('Form data upload was cancelled.'));
      request.ontimeout = () => reject(new Error('Form data upload timed out.'));
      request.send(body);
    });
  }

  const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message = payload?.message;
    throw new ApiRequestError(
      Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : `Request failed (${response.status}).`,
      response.status,
    );
  }

  return data as T;
}

/** Lightweight connectivity probe used during app startup and diagnostics. */
export async function checkApiHealth(): Promise<boolean> {
  const health = await apiRequest<{ services?: { api?: string } }>('/api/v1/health');
  return health.services?.api === 'up';
}
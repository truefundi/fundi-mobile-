import { apiRequest } from '@/lib/api';

/** One thing the customer scores, configured by admins (e.g. "Punctuality"). */
export type RatingItem = { id: string; name: string; description?: string | null };

export type JobRating = {
  id: string;
  jobId: string;
  comment: string | null;
  averageScore: number | null;
  submittedAt: string;
  updatedAt: string;
  responses: { itemId: string; item: string; score: number }[];
};

export type JobRatingState = {
  items: RatingItem[];
  /** The customer's rating for this job, once given. */
  rating: JobRating | null;
};

export type RatingInput = { responses: { itemId: string; score: number }[]; comment?: string | null };

const base = (jobId: string) => `/api/v1/jobs/mine/${jobId}`;

/** What to rate on a completed job and the customer's rating so far. */
export async function fetchJobRating(jobId: string): Promise<JobRatingState> {
  const data = await apiRequest<{ items: RatingItem[]; rating: JobRating | null }>(`${base(jobId)}/rating-items`, {
    authenticated: true,
  });
  return { items: data.items, rating: data.rating };
}

export function submitJobRating(jobId: string, input: RatingInput): Promise<JobRating> {
  return apiRequest<JobRating>(`${base(jobId)}/rating`, { method: 'POST', authenticated: true, body: input });
}

export function updateJobRating(jobId: string, input: RatingInput): Promise<JobRating> {
  return apiRequest<JobRating>(`${base(jobId)}/rating`, { method: 'PATCH', authenticated: true, body: input });
}

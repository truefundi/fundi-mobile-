/**
 * Dynamic, role-aware cancellation messaging and helpers.
 */

/**
 * Extracts the first name from a full name string, accounting for
 * common compound first names (e.g. "Jean Paul", "Marie Claire", etc.).
 */
export function extractFirstName(fullName?: string): string {
  if (!fullName || !fullName.trim()) return 'Technician';
  const clean = fullName.trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];

  const compoundPrefixes = ['jean', 'marie', 'john', 'mary', 'anne'];
  if (parts.length >= 2 && compoundPrefixes.includes(parts[0].toLowerCase())) {
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
}

export type CancellationContext = {
  cancelledByRole?: 'client' | 'technician' | string;
  cancelledByName?: string;
  cancelledById?: string;
  currentUserId?: string;
  currentUserRole: 'client' | 'technician';
  currentUserName?: string;
  otherParticipantName: string;
};

/**
 * Returns perspective-aware cancellation wording:
 * - If the logged-in user cancelled: "Job cancelled by you."
 * - If the opposite party cancelled: "Job cancelled by [First Name]." (e.g., "Job cancelled by Alice." or "Job cancelled by Jean Paul.")
 */
export function formatCancellationNotice({
  cancelledByRole,
  cancelledByName,
  cancelledById,
  currentUserId,
  currentUserRole,
  currentUserName,
  otherParticipantName,
}: CancellationContext): string {
  const isMe =
    (Boolean(cancelledById) && Boolean(currentUserId) && cancelledById === currentUserId) ||
    (Boolean(cancelledByRole) && cancelledByRole!.toLowerCase() === currentUserRole.toLowerCase()) ||
    (Boolean(cancelledByName) &&
      Boolean(currentUserName) &&
      cancelledByName!.trim().toLowerCase() === currentUserName!.trim().toLowerCase());

  if (isMe) {
    return 'Job cancelled by you.';
  }

  const nameToUse = cancelledByName || otherParticipantName;
  const firstName = extractFirstName(nameToUse);
  return `Job cancelled by ${firstName}.`;
}

/**
 * Checks if a string or event text represents a cancellation or termination event.
 */
export function isCancellationEvent(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('job cancelled') ||
    lower.includes('request cancelled') ||
    lower.includes('request ended') ||
    lower.includes('ended this service request') ||
    lower.includes('declined this request') ||
    lower.includes('technician declined')
  );
}

/**
 * Infers which role initiated the cancellation from message details or text.
 */
export function inferCancelledRole(
  msg: { senderRole?: string; text?: string; cancelledByRole?: string; senderId?: string },
  defaultRole: 'client' | 'technician' = 'client',
): 'client' | 'technician' {
  if (msg.cancelledByRole === 'client' || msg.cancelledByRole === 'technician') {
    return msg.cancelledByRole;
  }
  const text = (msg.text || '').toLowerCase();
  if (text.includes('technician declined') || text.includes('by the technician') || text.includes('by technician')) {
    return 'technician';
  }
  if (
    text.includes('client cancelled') ||
    text.includes('client ended') ||
    text.includes('by the client') ||
    text.includes('by client') ||
    text.includes('ended this service request')
  ) {
    return 'client';
  }
  if (msg.senderRole === 'technician' || msg.senderRole === 'client') {
    return msg.senderRole;
  }
  return defaultRole;
}

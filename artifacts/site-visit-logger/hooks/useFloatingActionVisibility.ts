import { useMemo } from 'react';
import type { Job, JobStatus } from '@/constants/jobs';

export interface FloatingActionVisibilityOptions {
  /** Master toggle to completely hide all floating action buttons */
  hideAll?: boolean;
  /** Explicit override to hide or show the AI Chatbot button */
  hideBot?: boolean;
  /** Explicit override to hide or show the SOS emergency button */
  hideSos?: boolean;
  /**
   * Current app / screen mode (e.g. 'hiring' for customer, 'working' for technician).
   * In 'working' mode, the customer emergency SOS button is hidden by default.
   */
  mode?: 'hiring' | 'working' | string;
  /** Whether the user is actively searching or entering search input */
  isSearching?: boolean;
  /** Whether to automatically hide buttons while searching. Defaults to false. */
  hideWhenSearching?: boolean;
  /** Current active job (if any) */
  activeJob?: Job | null;
  /** Specific job statuses during which SOS should be hidden */
  hideSosOnJobStatuses?: JobStatus[];
  /** Whether to hide SOS if any active job is currently ongoing. Defaults to false. */
  hideSosWhenActiveJob?: boolean;
  /** Whether to hide AI chatbot when an active job is present. Defaults to false. */
  hideBotWhenActiveJob?: boolean;
  /** Whether to allow SOS button in technician 'working' mode. Defaults to false. */
  allowWorkingSos?: boolean;
}

export interface FloatingActionVisibilityState {
  /** Whether the AI Chatbot button should be hidden */
  hideBot: boolean;
  /** Whether the SOS button should be hidden */
  hideSos: boolean;
  /** Whether at least one button is visible (container renders) */
  isVisible: boolean;
}

/**
 * Hook to manage visibility controls for FloatingActionGroup buttons based on
 * active job status, screen mode, search state, and explicit overrides.
 */
export function useFloatingActionVisibility(
  options: FloatingActionVisibilityOptions = {}
): FloatingActionVisibilityState {
  const {
    hideAll = false,
    hideBot,
    hideSos,
    mode = 'hiring',
    isSearching = false,
    hideWhenSearching = false,
    activeJob,
    hideSosOnJobStatuses,
    hideSosWhenActiveJob = false,
    hideBotWhenActiveJob = false,
    allowWorkingSos = false,
  } = options;

  return useMemo(() => {
    if (hideAll) {
      return {
        hideBot: true,
        hideSos: true,
        isVisible: false,
      };
    }

    // Determine Chatbot button visibility
    let computedHideBot = false;
    if (typeof hideBot === 'boolean') {
      computedHideBot = hideBot;
    } else if (isSearching && hideWhenSearching) {
      computedHideBot = true;
    } else if (activeJob && hideBotWhenActiveJob) {
      computedHideBot = true;
    }

    // Determine SOS button visibility
    let computedHideSos = false;
    if (typeof hideSos === 'boolean') {
      computedHideSos = hideSos;
    } else if (mode === 'working' && !allowWorkingSos) {
      // Technicians in 'working' mode don't see customer emergency SOS button
      computedHideSos = true;
    } else if (isSearching && hideWhenSearching) {
      computedHideSos = true;
    } else if (activeJob && hideSosWhenActiveJob) {
      computedHideSos = true;
    } else if (
      activeJob &&
      hideSosOnJobStatuses &&
      hideSosOnJobStatuses.includes(activeJob.status)
    ) {
      computedHideSos = true;
    }

    const isVisible = !(computedHideBot && computedHideSos);

    return {
      hideBot: computedHideBot,
      hideSos: computedHideSos,
      isVisible,
    };
  }, [
    hideAll,
    hideBot,
    hideSos,
    mode,
    isSearching,
    hideWhenSearching,
    activeJob,
    hideSosOnJobStatuses,
    hideSosWhenActiveJob,
    hideBotWhenActiveJob,
    allowWorkingSos,
  ]);
}

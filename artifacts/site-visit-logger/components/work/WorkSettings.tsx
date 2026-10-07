import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Worker dispatch preferences stay unavailable until their backend API exists. */
export function WorkSettings() {
  return (
    <EmptyState
      icon="sliders"
      title="Work preferences are not available yet"
      text="Travel radius, daily job limits, and work hours will be configurable when the technician preferences API is ready."
    />
  );
}

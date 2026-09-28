import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWork } from '@/context/WorkContext';

/**
 * What a working-mode tab shows before verification clears.
 *
 * Falling back to the customer screen here would leave the app half in each
 * role — Home asking for documents while Activity lists jobs you requested as
 * a customer. This says plainly why the tab is empty and where to go.
 */
export function WorkLocked() {
  const { status } = useWork();
  const pending = status === 'pending';

  return (
    <EmptyState
      icon={pending ? 'clock' : 'file-text'}
      tone="waiting"
      title={pending ? 'Documents under review' : 'Finish your application'}
      text={
        pending
          ? 'This opens up as soon as your certificate and ID clear.'
          : 'Add your trade, ID and a certificate on Home to start taking jobs.'
      }
    />
  );
}

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISPUTES_KEY } from '@/constants/storage';

export type DisputePartyRole = 'client' | 'technician';
export type DisputeStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface DisputeStatement {
  id: string;
  submittedBy: DisputePartyRole;
  submitterName: string;
  submitterPhone: string;
  reason: string;
  description: string;
  desiredOutcome: string;
  createdAt: string;
  evidencePhotoUri?: string;
}

export interface DisputeRecord {
  id: string;
  jobId: string;
  jobReference?: string;
  service: string;
  clientName: string;
  clientPhone: string;
  technicianName: string;
  technicianPhone: string;
  agreedPrice?: number;
  status: DisputeStatus;
  createdAt: string;
  updatedAt: string;
  statements: DisputeStatement[];
}

export interface SubmitDisputeParams {
  jobId: string;
  jobReference?: string;
  service: string;
  role: DisputePartyRole;
  submitterName: string;
  submitterPhone: string;
  clientName: string;
  clientPhone: string;
  technicianName: string;
  technicianPhone: string;
  agreedPrice?: number;
  reason: string;
  description: string;
  desiredOutcome: string;
  evidencePhotoUri?: string;
}

interface DisputeContextType {
  disputes: DisputeRecord[];
  submitDisputeStatement: (params: SubmitDisputeParams) => Promise<DisputeRecord>;
  getDisputeForJob: (jobId: string) => DisputeRecord | undefined;
}

const DisputeContext = createContext<DisputeContextType | undefined>(undefined);

export function DisputeProvider({ children }: { children: React.ReactNode }) {
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISPUTES_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setDisputes(parsed);
            }
          } catch {
            // parse error fallback
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  const persistDisputes = async (updated: DisputeRecord[]) => {
    setDisputes(updated);
    try {
      await AsyncStorage.setItem(DISPUTES_KEY, JSON.stringify(updated));
    } catch {
      // non-blocking persistence
    }
  };

  const getDisputeForJob = (jobId: string): DisputeRecord | undefined => {
    return disputes.find((d) => d.jobId === jobId);
  };

  const submitDisputeStatement = async (params: SubmitDisputeParams): Promise<DisputeRecord> => {
    const now = new Date().toISOString();
    const statement: DisputeStatement = {
      id: `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      submittedBy: params.role,
      submitterName: params.submitterName,
      submitterPhone: params.submitterPhone,
      reason: params.reason,
      description: params.description,
      desiredOutcome: params.desiredOutcome,
      createdAt: now,
      evidencePhotoUri: params.evidencePhotoUri,
    };

    const existingIndex = disputes.findIndex((d) => d.jobId === params.jobId);
    let updatedDisputes: DisputeRecord[];
    let targetDispute: DisputeRecord;

    if (existingIndex >= 0) {
      const existing = disputes[existingIndex];
      targetDispute = {
        ...existing,
        updatedAt: now,
        status: 'UNDER_REVIEW',
        statements: [...existing.statements, statement],
      };
      updatedDisputes = [...disputes];
      updatedDisputes[existingIndex] = targetDispute;
    } else {
      targetDispute = {
        id: `disp-${Date.now()}`,
        jobId: params.jobId,
        jobReference: params.jobReference,
        service: params.service,
        clientName: params.clientName,
        clientPhone: params.clientPhone,
        technicianName: params.technicianName,
        technicianPhone: params.technicianPhone,
        agreedPrice: params.agreedPrice,
        status: 'SUBMITTED',
        createdAt: now,
        updatedAt: now,
        statements: [statement],
      };
      updatedDisputes = [targetDispute, ...disputes];
    }

    await persistDisputes(updatedDisputes);
    return targetDispute;
  };

  const value = useMemo(
    () => ({
      disputes,
      submitDisputeStatement,
      getDisputeForJob,
    }),
    [disputes]
  );

  return <DisputeContext.Provider value={value}>{children}</DisputeContext.Provider>;
}

export function useDisputes(): DisputeContextType {
  const context = useContext(DisputeContext);
  if (!context) {
    return {
      disputes: [],
      submitDisputeStatement: async () => ({} as DisputeRecord),
      getDisputeForJob: () => undefined,
    };
  }
  return context;
}


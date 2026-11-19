import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { useChatRoom, type ChatTimelineMessage } from '@/hooks/useChatRoom';
import { useJobWorkspace } from '@/hooks/useJobWorkspace';
import { onChatEvent } from '@/lib/chat-socket';
import { CHAT_TEXT_MAX_LENGTH, type BackendChatRoom } from '@/lib/chat-rooms-api';
import type { ConversationMessageItem, PriceOfferItem } from '@/lib/conversations-api';
import { deriveLifecycle, offersRemaining, type LifecycleAction } from '@/lib/job-lifecycle';
import { getServiceIcon } from '@/lib/categories-api';
import { fetchPublicTechnicianById } from '@/lib/technicians-api';
import type { MarketplaceTechnician } from '@/constants/technicians';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { JobProgressStepper, ProgressToggle } from '@/components/chat/JobProgressStepper';
import { useDisputes } from '@/context/DisputeContext';
import { ReportDisputeModal } from '@/components/dispute/ReportDisputeModal';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';
import { OfferCard } from '@/components/chat/OfferCard';
import { OfferSheet, ReasonSheet } from '@/components/chat/ChatSheets';
import { RequestCard, buildRequestSummary } from '@/components/chat/RequestCard';
import { IncomingRequestIntro, buildOfferSummary, formatCountdown, useSecondsLeft } from '@/components/chat/IncomingRequestView';
import { ActionDialog, type DialogRequest } from '@/components/ui/ActionDialog';
import { RatingBar, RatingSheet } from '@/components/chat/RatingPanel';
import { fetchJobRating, submitJobRating, updateJobRating, type JobRatingState } from '@/lib/ratings-api';
import { retryJobDispatch, type TechnicianOfferItem } from '@/lib/jobs-api';

type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/**
 * Unified job chat: messages (`/chat/rooms` + the `/chat` socket) and the
 * structured price negotiation (`/conversations`) in one stream, with the
 * service request card pinned at the start, a role-aware progress stepper
 * (Technician Found → Price Agreed → Job Start → Job End) and pre-agreement
 * pull-out.
 *
 * Each job has exactly one chat, opened as `/chat/<jobId>`. Older links with a
 * chat room id or negotiation id still resolve to the same job's chat.
 *
 * Access rules: clients can only message or negotiate once the job's booking
 * fee is paid; technicians can as soon as they are assigned. Before the price
 * is agreed either side can pull out; afterwards the client may cancel the job
 * and the technician may request a cancellation for admin review.
 */

type TimelineItem =
  | { kind: 'chat'; key: string; at: string; message: ChatTimelineMessage }
  | { kind: 'conv'; key: string; at: string; message: ConversationMessageItem };

type ReasonFlow = 'pull-out' | 'decline-request' | 'cancel-open-job' | 'restricted' | 'deny-offer';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why the room is read-only for messages, or null when it accepts them. */
function roomLockReason(room: BackendChatRoom | null, isTechnician: boolean): string | null {
  if (!room) return null;
  if (room.currentMember?.blockedAt) return 'You can no longer send messages in this chat.';
  if (room.status === 'COMPLETED') return 'This job is complete. The chat is now read-only.';
  if (room.status === 'DISABLED') {
    return room.disabledReason ? `Chat closed: ${room.disabledReason}` : 'This chat has been closed.';
  }
  if (room.assignment.endedAt) {
    return isTechnician ? 'You are no longer assigned to this job.' : 'This technician is no longer assigned to the job.';
  }
  return null;
}

/** One line of text at 14/20 plus vertical padding: the same height as the composer buttons. */
const INPUT_MIN_HEIGHT = 42;
/** Jobs whose rating sheet already opened by itself during this app session. */
const promptedRatings = new Set<string>();
const INPUT_MAX_HEIGHT = 120;

const ACTION_LABEL: Record<LifecycleAction['kind'], string> = {
  'accept-request': 'Accept request',
  'make-offer': 'Propose price',
  'respond-offer': 'Review offer',
  'confirm-cooperation': 'Confirm & start',
  'start-job': 'Start job',
  'finish-job': 'Mark finished',
  'confirm-completion': 'Confirm done',
};

export default function JobChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const { getJob, proposeTechnicianToJob } = useFundi();
  const { threads } = useChat();
  const { technicianOffers, acceptOffer: acceptTechnicianOffer, rejectOffer, refreshJobs, actingAsTechnician } = useWork();
  const { id: routeId, requestId, firstMessage, technicianId: technicianParam, proposalError, rate } = useLocalSearchParams<{
    id?: string;
    /** Opens the rating sheet straight away (from a completed job elsewhere in the app). */
    rate?: string;
    requestId?: string;
    firstMessage?: string;
    /** Technician profile the client routed this request to (before assignment). */
    technicianId?: string;
    /** Set when routing the request to the technician failed at submission. */
    proposalError?: string;
  }>();
  // A negotiation id in the route resolves to its job.
  const routeThread = useMemo(() => threads.find((t) => t.id === routeId), [threads, routeId]);
  const jobHint = requestId || routeThread?.jobId || undefined;

  const chat = useChatRoom(routeId, jobHint);
  const { room } = chat;
  // A technician can also hire, so the side comes from this chat: the room's member list,
  // then the negotiation, and only for a brand-new request from the current mode.
  const roomSide = room?.members.find((member) => member.userId === account?.id)?.role;
  const isTechnician = roomSide
    ? roomSide === 'TECHNICIAN'
    : routeThread
      ? routeThread.otherParticipantRole === 'client'
      : actingAsTechnician;
  const viewerSide = isTechnician ? 'TECHNICIAN' : 'CUSTOMER';
  const roomSettled = chat.resolution === 'found' || chat.resolution === 'not-found';
  // Once known, the job stays fixed for this screen so later data never swaps the chat underneath.
  const pinnedJob = useRef<{ route?: string; jobId?: string }>({});
  if (pinnedJob.current.route !== routeId) pinnedJob.current = { route: routeId };
  const resolvedJobId =
    room?.jobId ?? jobHint ?? (chat.resolution === 'not-found' && !routeThread ? routeId : undefined);
  if (resolvedJobId && !pinnedJob.current.jobId) pinnedJob.current.jobId = resolvedJobId;
  const jobId = pinnedJob.current.jobId ?? resolvedJobId;

  // A technician opening a request that was routed to them but not answered yet.
  const incomingOffer = useMemo(() => {
    if (!isTechnician || room) return undefined;
    const keys = [routeId, requestId].filter(Boolean);
    return technicianOffers.find(
      (offer) =>
        offer.status === 'OFFERED' &&
        (keys.includes(offer.job.id) || keys.includes(offer.id)) &&
        (!offer.expiresAt || new Date(offer.expiresAt).getTime() > Date.now()),
    );
  }, [isTechnician, room, technicianOffers, routeId, requestId]);

  // After accepting, the request stays on screen in the same layout until the chat room loads.
  const [acceptedOffer, setAcceptedOffer] = useState<TechnicianOfferItem | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [decliningOffer, setDecliningOffer] = useState(false);
  const pendingOffer: TechnicianOfferItem | undefined = room ? undefined : incomingOffer ?? acceptedOffer ?? undefined;
  const offerSecondsLeft = useSecondsLeft(incomingOffer?.expiresAt);
  const offerExpired = Boolean(incomingOffer) && !acceptedOffer && offerSecondsLeft === 0;
  useEffect(() => {
    if (offerExpired) void refreshJobs();
  }, [offerExpired, refreshJobs]);

  const workspace = useJobWorkspace({
    // Unassigned technicians cannot read the job yet; the offer carries the request instead.
    jobId: roomSettled && !pendingOffer ? jobId : undefined,
    conversationId: routeThread?.id,
    roomId: room?.id,
    active: true,
    asTechnician: isTechnician,
  });
  const { job, conversation } = workspace;

  // Client: after either side pulls out before a price is agreed, the job is open
  // again with nobody assigned. The old chat room stays as read-only history, but
  // the screen works as if there were no room, so the client can send the same
  // paid request to another technician.
  const releasedFromRoom = !isTechnician && Boolean(room) && job?.status === 'OPEN' && !job.currentTechnician;
  const liveRoom = releasedFromRoom ? null : room;

  // Job events from the chat socket (progress, pull-out, cancel) trigger an immediate resync.
  useEffect(() => {
    if (!room) return;
    return onChatEvent('chat:job:updated', (payload: { id?: string }) => {
      if (!payload?.id || payload.id === room.jobId) void workspace.refresh();
    });
  }, [room, workspace.refresh]);

  // Client: who the request was routed to, shown until a technician is assigned.
  // The backend reports who an open request is routed to (or who last let it go).
  const routing = !isTechnician && !liveRoom ? job?.activeOffer ?? job?.lastOffer ?? null : null;
  const proposedTechnicianId =
    !isTechnician && !liveRoom
      ? routing?.technicianId || (releasedFromRoom ? undefined : technicianParam || getJob(jobId ?? '')?.technician?.id)
      : undefined;
  const [proposedTechnician, setProposedTechnician] = useState<MarketplaceTechnician | null>(null);
  useEffect(() => {
    if (!proposedTechnicianId) return;
    let cancelled = false;
    fetchPublicTechnicianById(proposedTechnicianId)
      .then((tech) => {
        if (!cancelled) setProposedTechnician(tech);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [proposedTechnicianId]);

  const lifecycle = useMemo(() => {
    const derived = deriveLifecycle({ role: isTechnician ? 'technician' : 'client', job, room: liveRoom, conversation });
    if (!pendingOffer) return derived;
    // A request routed to this technician and not answered yet (or just accepted).
    const countdown = formatCountdown(offerSecondsLeft);
    return {
      ...derived,
      action: acceptedOffer || offerExpired ? null : ({ kind: 'accept-request' } as const),
      cancellation: 'none' as const,
      headline: acceptedOffer
        ? 'Request accepted. Opening the chat…'
        : offerExpired
          ? 'This request expired before it was answered.'
          : `New request. Accept it${countdown ? ` within ${countdown}` : ''} to agree on a price.`,
    };
  }, [isTechnician, job, liveRoom, conversation, pendingOffer, acceptedOffer, offerExpired, offerSecondsLeft]);

  const localJob = jobId ? getJob(jobId) : undefined;
  const cachedFeePaid = localJob?.bookingFee?.status === 'PAID';
  const feeStatus: 'PAID' | 'UNPAID' | 'checking' | 'unknown' = isTechnician || cachedFeePaid
    ? 'PAID'
    : job
      ? job.bookingPayment ? 'PAID' : 'UNPAID'
      : workspace.isLoading
        ? 'checking'
        : 'unknown';
  const feeBlocksClient = !isTechnician && feeStatus !== 'PAID';

  // After a pull-out the old room's "closed" notice no longer applies: the request is moving on.
  const lockReason = releasedFromRoom ? null : roomLockReason(room, isTechnician);
  const canMessage = Boolean(room && chat.canWrite && !feeBlocksClient);
  const canNegotiate = lifecycle.canNegotiate && !feeBlocksClient;
  const remainingOffers = offersRemaining(conversation, viewerSide);

  const [draft, setDraft] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [autoRouting, setAutoRouting] = useState(false);
  const [offerSheet, setOfferSheet] = useState<{ mode: 'offer' | 'counter'; reference?: PriceOfferItem } | null>(null);
  const [reasonFlow, setReasonFlow] = useState<{ flow: ReasonFlow; offer?: PriceOfferItem } | null>(null);
  const listRef = useRef<FlatList<TimelineItem>>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const { getDisputeForJob } = useDisputes();
  const chatDispute = jobId ? getDisputeForJob(jobId) : undefined;
  const [showDisputeReport, setShowDisputeReport] = useState(false);
  const [showDisputeDetails, setShowDisputeDetails] = useState(false);

  // ── Rating: the client rates the technician once the job is complete ────
  const canRate = !isTechnician && job?.status === 'COMPLETED' && Boolean(jobId);
  const [ratingState, setRatingState] = useState<JobRatingState | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSheet, setRatingSheet] = useState<{ initialScore?: number } | null>(null);
  const ratingPrompted = useRef(false);
  useEffect(() => {
    if (!canRate || !jobId) return;
    let cancelled = false;
    setRatingLoading(true);
    fetchJobRating(jobId)
      .then((state) => {
        if (cancelled) return;
        setRatingState(state);
        // Ask once, right after the job is done; afterwards the bar at the bottom stays.
        if (!ratingPrompted.current && (rate === '1' || !state.rating)) {
          ratingPrompted.current = true;
          if (rate === '1' || !promptedRatings.has(jobId)) {
            promptedRatings.add(jobId);
            setRatingSheet({});
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRatingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRate, jobId, rate]);
  /** Whether the progress tracker is dropped down from the header. */
  const [progressOpen, setProgressOpen] = useState(false);
  /** Composer height: one line, growing with the text up to five lines. */
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  /** Same shape as `Alert.alert`, drawn in-app so it also works on web. */
  const showDialog = useCallback((title: string, message?: string, buttons?: DialogButton[]) => {
    setDialog({
      title,
      message,
      actions: (buttons ?? [{ text: 'OK', style: 'cancel' }]).map((b) => ({ label: b.text, style: b.style, onPress: b.onPress })),
    });
  }, []);

  // ── Navigation guards: never return into checkout screens ───────────────
  const goToList = useCallback(() => router.replace('/(tabs)/chat'), [router]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToList();
      return true;
    });
    return () => sub.remove();
  }, [goToList]);

  // ── Participants ────────────────────────────────────────────────────────
  const otherParty = isTechnician
    ? room?.job.customer ?? conversation?.customer ?? null
    : releasedFromRoom
      ? null
      : room?.job.technician ?? conversation?.technician ?? null;
  const otherName =
    (releasedFromRoom && !job?.activeOffer ? 'Choose a technician' : undefined) ||
    otherParty?.fullName ||
    (pendingOffer ? pendingOffer.customer?.fullName?.trim() : undefined) ||
    (!isTechnician
      ? job?.currentTechnician?.fullName || proposedTechnician?.name || routing?.technicianName || localJob?.technician?.name
      : undefined) ||
    (isTechnician ? 'Client' : 'Technician');
  const otherAvatar = pendingOffer
    ? pendingOffer.customer?.profilePictureUrl ?? undefined
    : !isTechnician
    ? job?.currentTechnician?.profile?.profilePictureUrl ||
      (releasedFromRoom && !job?.activeOffer
        ? undefined
        : !liveRoom
          ? proposedTechnician?.avatarUrl || routing?.technicianProfilePictureUrl
          : undefined) ||
      localJob?.technician?.avatarUrl ||
      localJob?.technician?.photoUri ||
      undefined
    : undefined;
  /** Technician profile to open from the header (clients only). */
  const technicianProfileId = !isTechnician ? job?.currentTechnician?.id ?? proposedTechnician?.id : undefined;
  const otherPhone = isTechnician
    ? conversation?.customer?.phoneNumber
    : conversation?.technician?.phoneNumber ?? localJob?.technician?.phone;
  const nameForSide = (side: string) =>
    side === 'TECHNICIAN'
      ? room?.job.technician?.fullName ?? conversation?.technician?.fullName ?? 'Technician'
      : room?.job.customer?.fullName ?? conversation?.customer?.fullName ?? 'Client';

  const summary = useMemo(
    () =>
      pendingOffer
        ? buildOfferSummary(pendingOffer)
        : jobId
          ? buildRequestSummary(jobId, job, conversation, room)
          : null,
    [pendingOffer, jobId, job, conversation, room],
  );

  // ── Merged timeline (newest first for the inverted list) ────────────────
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = chat.messages.map((message) => ({
      kind: 'chat',
      key: `chat-${message.id}`,
      at: message.createdAt,
      message,
    }));
    // While older chat pages are unloaded, hide negotiation entries older than them to keep order honest.
    const oldestLoaded = chat.hasOlder && chat.messages[0] ? new Date(chat.messages[0].createdAt).getTime() : 0;
    for (const message of conversation?.messages ?? []) {
      if (message.type === 'SERVICE_REQUEST') continue;
      if (new Date(message.createdAt).getTime() < oldestLoaded) continue;
      items.push({ kind: 'conv', key: `conv-${message.id}`, at: message.createdAt, message });
    }
    return items.sort((a, b) => {
      const diff = new Date(b.at).getTime() - new Date(a.at).getTime();
      if (diff !== 0) return diff;
      // Keep optimistic (unsent) chat messages newest.
      const aPending = a.kind === 'chat' && a.message.delivery ? 1 : 0;
      const bPending = b.kind === 'chat' && b.message.delivery ? 1 : 0;
      return bPending - aPending;
    });
  }, [chat.messages, chat.hasOlder, conversation?.messages]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const fail = (title: string) => (err: unknown) =>
    showDialog(title, err instanceof Error ? err.message : 'Please try again.');

  const handleSend = () => {
    const text = draft.trim();
    if (!canMessage || !text) return;
    try {
      chat.sendText(text);
      setDraft('');
    } catch (err) {
      fail('Message not sent')(err);
    }
  };

  const handleChangeDraft = (value: string) => {
    setDraft(value);
    if (canMessage) chat.setTyping(value.trim().length > 0);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    chat.sendMedia('IMAGE', {
      uri: asset.uri,
      name: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? undefined,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    chat.sendMedia('FILE', {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      sizeBytes: asset.size ?? undefined,
    });
  };

  const handleAttach = () => {
    if (!canMessage) return;
    showDialog(`Share with your ${isTechnician ? 'client' : 'technician'}`, undefined, [
      { text: 'Photo', onPress: () => void pickImage() },
      { text: 'Document', onPress: () => void pickDocument() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openOfferComposer = () => {
    if (!canNegotiate) return;
    if (remainingOffers <= 0) {
      showDialog('Offer limit reached', 'You have used all your offers for this negotiation.');
      return;
    }
    const pending = conversation?.currentOffer?.status === 'PENDING' ? conversation.currentOffer : undefined;
    setOfferSheet(pending && pending.senderRole !== viewerSide ? { mode: 'counter', reference: pending } : { mode: 'offer', reference: pending });
  };

  const acceptOffer = (offer: PriceOfferItem) => {
    showDialog(
      'Agree on this price?',
      `${offer.currency} ${offer.amount.toLocaleString()} becomes the agreed repair price and the job is confirmed straight away. The booking fee is separate and is used up. Pulling out is no longer possible after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Agree & confirm', onPress: () => void workspace.acceptOffer(offer.id).catch(fail('Could not accept offer')) },
      ],
    );
  };

  const denyOffer = (offer: PriceOfferItem) => {
    const canCounter = remainingOffers > 0;
    showDialog(
      'Deny this offer?',
      `Denying ends the price negotiation for this job.${canCounter ? ' To keep negotiating, send a counter-offer instead.' : ''}`,
      [
        { text: 'Keep negotiating', style: 'cancel' },
        ...(canCounter ? [{ text: 'Counter instead', onPress: () => setOfferSheet({ mode: 'counter' as const, reference: offer }) }] : []),
        { text: 'Deny', style: 'destructive' as const, onPress: () => setReasonFlow({ flow: 'deny-offer', offer }) },
      ],
    );
  };

  const runLifecycleAction = (action: LifecycleAction) => {
    switch (action.kind) {
      case 'accept-request':
        if (pendingOffer) {
          void acceptIncoming(pendingOffer);
          return;
        }
        void workspace.acceptRequest().catch(fail('Could not accept request'));
        return;
      case 'make-offer':
        openOfferComposer();
        return;
      case 'respond-offer':
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      case 'confirm-cooperation':
        showDialog(
          'Confirm and start?',
          'Once both of you confirm, the job is locked in and pulling out is no longer possible.',
          [
            { text: 'Not yet', style: 'cancel' },
            { text: 'Confirm', onPress: () => void workspace.confirmCooperation().catch(fail('Could not confirm')) },
          ],
        );
        return;
      case 'start-job':
        void workspace.updateProgress('IN_PROGRESS').catch(fail('Could not start the job'));
        return;
      case 'finish-job':
      case 'confirm-completion':
        showDialog(
          action.kind === 'finish-job' ? 'Mark the job finished?' : 'Confirm the job is done?',
          action.kind === 'finish-job'
            ? 'The client will be asked to confirm completion.'
            : 'This closes the job and the chat becomes read-only.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: () => void workspace.completeMyProgress().catch(fail('Could not update progress')) },
          ],
        );
        return;
    }
  };

  // Cancel button on the request card.
  const cancelLabel =
    lifecycle.cancellation === 'pull-out'
      ? 'Pull Out'
      : lifecycle.cancellation === 'decline-request'
        ? 'Decline Request'
        : lifecycle.cancellation === 'cancel-open-job'
          ? 'Cancel Request'
          : lifecycle.cancellation === 'restricted'
            ? isTechnician ? 'Request cancellation' : 'Cancel Job'
            : null;
  const startCancel = () => {
    if (lifecycle.cancellation === 'none') return;
    setReasonFlow({ flow: lifecycle.cancellation });
  };

  const reasonCopy: Record<ReasonFlow, { title: string; description: string; confirm: string; required: boolean }> = {
    'pull-out': {
      title: isTechnician ? 'Pull out of this job' : 'Choose a different technician',
      description: isTechnician
        ? 'You can pull out before the price is agreed. The job goes back to the client to find another technician.'
        : 'You can pull out before the price is agreed. Your booking fee stays valid, so you can send this request to another technician without paying again.',
      confirm: 'Pull out',
      required: true,
    },
    'decline-request': {
      title: 'Decline this request',
      description: 'Tell the client why so they can find another technician.',
      confirm: 'Decline request',
      required: true,
    },
    'cancel-open-job': {
      title: 'Cancel this request',
      description: 'No technician is assigned yet. Cancelling stops the search.',
      confirm: 'Cancel request',
      required: true,
    },
    restricted: {
      title: isTechnician ? 'Request cancellation' : 'Cancel the job',
      description: isTechnician
        ? 'The price is already agreed, so cancelling needs administrator review. Explain what happened.'
        : 'The price is already agreed. Cancelling now ends the job with this technician.',
      confirm: isTechnician ? 'Send for review' : 'Cancel job',
      required: true,
    },
    'deny-offer': {
      title: 'Deny offer',
      description: 'The negotiation stays open, so either of you can make another offer. Add a reason to help them (optional).',
      confirm: 'Deny offer',
      required: false,
    },
  };

  const submitReason = async (reason: string) => {
    if (!reasonFlow) return;
    switch (reasonFlow.flow) {
      case 'pull-out':
        await workspace.pullOut(reason);
        return;
      case 'decline-request':
        await workspace.declineRequest(reason);
        return;
      case 'cancel-open-job':
        await workspace.cancelOpenJob(reason);
        return;
      case 'restricted': {
        const result = await workspace.cancelAfterAgreement(reason);
        if (isTechnician) {
          showDialog('Cancellation requested', result?.message ?? 'An administrator will review your request.');
        }
        return;
      }
      case 'deny-offer':
        if (reasonFlow.offer) await workspace.declineOffer(reasonFlow.offer.id, reason);
        return;
    }
  };

  const openAttachment = (message: ChatTimelineMessage) => {
    const url = message.downloadUrl;
    if (!url) return;
    if (message.type === 'IMAGE') {
      setPreviewUri(url);
      return;
    }
    Linking.openURL(url).catch(() => showDialog('Unable to open attachment', 'Try again in a moment.'));
  };

  const handleFailedPress = (message: ChatTimelineMessage) => {
    showDialog('Message not sent', message.deliveryError ?? 'The message could not be delivered.', [
      { text: 'Retry', onPress: () => chat.retryMessage(message.id) },
      { text: 'Delete', style: 'destructive', onPress: () => chat.discardMessage(message.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Client: request routing state before a technician is assigned ──────
  const awaitingTechnician = !isTechnician && !liveRoom && job?.status === 'OPEN' && !job.currentTechnician;
  /**
   * The last technician left during the negotiation and no request has gone out
   * since. A request sent afterwards that was declined or expired is newer than
   * the end of the old assignment, and then its own message shows instead.
   */
  const assignmentEndedAt = Date.parse(room?.assignment?.endedAt ?? room?.disabledAt ?? '');
  const lastAnswerAt = Date.parse(routing?.respondedAt ?? routing?.expiresAt ?? '');
  const leftNegotiation =
    releasedFromRoom &&
    job?.dispatchStatus !== 'OFFERED' &&
    !(Number.isFinite(lastAnswerAt) && (!Number.isFinite(assignmentEndedAt) || lastAnswerAt > assignmentEndedAt));
  const requestDelivered = awaitingTechnician && job?.dispatchStatus === 'OFFERED';
  const routedName = proposedTechnician?.name ?? routing?.technicianName ?? localJob?.technician?.name ?? 'the technician';
  const routedAvatar = proposedTechnician?.avatarUrl ?? routing?.technicianProfilePictureUrl ?? undefined;
  const chooseAnotherTechnician = () => {
    if (!jobId) return;
    router.push({
      pathname: '/select-technician',
      params: { jobId, service: summary?.service ?? '', description: summary?.description ?? '' },
    });
  };
  // Fundi routes the request to the best eligible technician not asked yet.
  const findAnotherTechnician = async () => {
    if (!jobId) return;
    setAutoRouting(true);
    try {
      await retryJobDispatch(jobId);
      await workspace.refresh();
    } catch (err) {
      fail('No technician found')(err);
    } finally {
      setAutoRouting(false);
    }
  };
  const feeValidUntil = job?.bookingPayment?.validUntil ? new Date(job.bookingPayment.validUntil) : null;
  const feeValidityText =
    feeValidUntil && !Number.isNaN(feeValidUntil.getTime())
      ? `Booking fee valid until ${feeValidUntil.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`
      : null;
  const resendToSameTechnician = async () => {
    if (!jobId || !proposedTechnicianId) return;
    try {
      await proposeTechnicianToJob(jobId, proposedTechnicianId);
      await workspace.refresh();
    } catch (err) {
      fail('Request not sent')(err);
    }
  };

  // ── Technician: answer a request routed to them ─────────────────────────
  async function acceptIncoming(offer: TechnicianOfferItem) {
    setAcceptingOffer(true);
    try {
      await acceptTechnicianOffer(offer.id);
      // Keep showing the request until the job's chat room loads.
      setAcceptedOffer(offer);
      chat.retryResolve();
    } catch (err) {
      fail('Could not accept this request')(err);
    } finally {
      setAcceptingOffer(false);
    }
  }

  // ── Loading / not found ─────────────────────────────────────────────────
  const hasAnything = Boolean(room || conversation || job || pendingOffer);
  const stillLoading =
    chat.resolution === 'resolving' || (roomSettled && !room && workspace.isLoading && Boolean(jobId));
  if (!hasAnything) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <BackButton onPress={goToList} />
          <Text style={[styles.headerName, { color: colors.foreground, marginLeft: 10 }]}>Chat</Text>
        </View>
        <View style={styles.centerState}>
          {stillLoading ? (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Opening conversation…</Text>
            </>
          ) : chat.resolution === 'error' || workspace.loadError ? (
            <>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.centerTitle, { color: colors.foreground }]}>Can't reach chat right now</Text>
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
                {chat.resolveError ?? workspace.loadError ?? 'Check your connection and try again.'}
              </Text>
              <Button
                label="Try again"
                size="small"
                onPress={() => {
                  chat.retryResolve();
                  void workspace.refresh();
                }}
                style={{ marginTop: 14 }}
              />
            </>
          ) : (
            <>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.centerTitle, { color: colors.foreground }]}>Chat not open yet</Text>
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
                The chat opens once a technician is assigned to your request.
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Rendering helpers ───────────────────────────────────────────────────
  const separatorFor = (index: number) => {
    const item = timeline[index];
    const older = timeline[index + 1];
    const show = !older || new Date(older.at).toDateString() !== new Date(item.at).toDateString();
    return show ? (
      <View style={styles.dateSeparatorWrap}>
        <View style={[styles.dateSeparatorPill, { backgroundColor: colors.muted + '40' }]}>
          <Text style={[styles.dateSeparatorText, { color: colors.mutedForeground }]}>{dateLabel(item.at)}</Text>
        </View>
      </View>
    ) : null;
  };

  const systemBanner = (text: string, at: string, icon: keyof typeof Ionicons.glyphMap = 'information-circle-outline', tone = colors.primary) => (
    <View style={styles.systemWrap}>
      <View style={[styles.systemBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name={icon} size={14} color={tone} />
        <Text style={[styles.systemText, { color: colors.secondaryForeground }]}>{text}</Text>
      </View>
      <Text style={[styles.systemTime, { color: colors.mutedForeground }]}>{formatTime(at)}</Text>
    </View>
  );

  const renderConversationItem = (message: ConversationMessageItem) => {
    if (message.type === 'PRICE_OFFER' && message.offer) {
      const offer = message.offer;
      const isMine = offer.senderRole === viewerSide;
      return (
        <OfferCard
          offer={offer}
          isMine={isMine}
          senderName={nameForSide(offer.senderRole)}
          canRespond={offer.status === 'PENDING' && !isMine && canNegotiate}
          canCounter={remainingOffers > 0}
          busy={workspace.busy}
          onAccept={() => acceptOffer(offer)}
          onCounter={() => setOfferSheet({ mode: 'counter', reference: offer })}
          onDecline={() => denyOffer(offer)}
          time={formatTime(message.createdAt)}
        />
      );
    }
    if (message.type === 'TECHNICIAN_RESPONSE') {
      const declined = message.metadata?.decision === 'DECLINED';
      const reason = typeof message.metadata?.reason === 'string' ? message.metadata.reason : null;
      const who = isTechnician ? 'You' : nameForSide('TECHNICIAN');
      const text = declined
        ? `${who} declined the request${reason ? `: ${reason}` : '.'}`
        : `${who} accepted the request. Agree on a price to continue.`;
      return systemBanner(text, message.createdAt, declined ? 'close-circle-outline' : 'checkmark-circle-outline', declined ? colors.destructive : colors.success);
    }
    if (message.type === 'SYSTEM') {
      const agreed = message.text?.startsWith('Agreed');
      return systemBanner(message.text ?? 'Update', message.createdAt, agreed ? 'ribbon-outline' : 'information-circle-outline', agreed ? colors.success : colors.primary);
    }
    // Negotiation text notes render as regular bubbles.
    const isMe = message.senderRole === viewerSide;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        <View
          style={[
            styles.chatBubble,
            isMe ? styles.bubbleMe : [styles.bubbleOther, { borderColor: colors.border }],
            { backgroundColor: isMe ? colors.primary : colors.card },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>{message.text}</Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, { color: isMe ? colors.primaryForeground + 'B3' : colors.mutedForeground }]}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderChatItem = (item: ChatTimelineMessage) => {
    if (item.type === 'SYSTEM' || item.senderRole === 'SYSTEM' || item.senderRole === 'ADMIN') {
      return systemBanner(
        item.senderRole === 'ADMIN' ? `Fundi support: ${item.text ?? ''}` : item.text ?? 'Update',
        item.createdAt,
        item.senderRole === 'ADMIN' ? 'shield-checkmark-outline' : 'information-circle-outline',
      );
    }
    const isMe = item.senderId === account?.id;
    const textColor = isMe ? colors.primaryForeground : colors.foreground;
    const metaColor = isMe ? colors.primaryForeground + 'B3' : colors.mutedForeground;
    const hidden = item.isTombstone || item.isBlocked;
    const imageUri = item.type === 'IMAGE' ? item.localUri ?? item.downloadUrl : null;

    const deliveryIcon = !isMe ? null : item.delivery === 'sending' ? (
      <Ionicons name="time-outline" size={12} color={metaColor} />
    ) : item.delivery === 'failed' ? (
      <Ionicons name="alert-circle" size={13} color={colors.destructive} />
    ) : (
      <Ionicons name={item.readByOtherSide ? 'checkmark-done' : 'checkmark'} size={13} color={metaColor} />
    );

    let content: React.ReactNode;
    if (hidden) {
      content = (
        <Text style={[styles.bubbleText, styles.hiddenText, { color: metaColor }]}>
          {item.isTombstone ? 'This message was deleted' : 'This message was removed by a moderator'}
        </Text>
      );
    } else if (imageUri) {
      content = (
        <Pressable onPress={() => openAttachment(item)} disabled={!item.downloadUrl}>
          <Image source={{ uri: imageUri }} style={styles.chatPhoto} resizeMode="cover" />
        </Pressable>
      );
    } else if (item.type === 'FILE' || item.type === 'VIDEO' || item.type === 'VOICE_NOTE') {
      const icon = item.type === 'VIDEO' ? 'video-outline' : item.type === 'VOICE_NOTE' ? 'microphone-outline' : 'file-document-outline';
      const label = item.type === 'VOICE_NOTE' ? 'Voice note' : item.fileName || (item.type === 'VIDEO' ? 'Video' : 'Document');
      const detail = item.type === 'VOICE_NOTE' && item.durationSeconds ? `${Math.round(item.durationSeconds)}s` : formatBytes(item.sizeBytes);
      content = (
        <Pressable onPress={() => openAttachment(item)} disabled={!item.downloadUrl} style={styles.attachmentRow}>
          <MaterialCommunityIcons name={icon as any} size={22} color={textColor} />
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={[styles.attachmentName, { color: textColor }]}>{label}</Text>
            {detail ? <Text style={[styles.attachmentDetail, { color: metaColor }]}>{detail}</Text> : null}
          </View>
        </Pressable>
      );
    } else {
      content = <Text style={[styles.bubbleText, { color: textColor }]}>{item.text}</Text>;
    }

    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        <Pressable
          disabled={item.delivery !== 'failed'}
          onPress={() => handleFailedPress(item)}
          style={[
            styles.chatBubble,
            isMe ? styles.bubbleMe : [styles.bubbleOther, { borderColor: colors.border }],
            { backgroundColor: isMe ? colors.primary : colors.card, opacity: item.delivery === 'sending' ? 0.7 : 1 },
          ]}
        >
          {content}
          <View style={styles.bubbleMeta}>
            {item.editedAt && !hidden ? <Text style={[styles.bubbleTime, { color: metaColor }]}>edited · </Text> : null}
            <Text style={[styles.bubbleTime, { color: metaColor }]}>{formatTime(item.createdAt)}</Text>
            {deliveryIcon}
          </View>
        </Pressable>
        {item.delivery === 'failed' ? (
          <Text style={[styles.failedText, { color: colors.destructive }]}>Not sent · tap to retry</Text>
        ) : null}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: TimelineItem; index: number }) => (
    <View>
      {separatorFor(index)}
      {item.kind === 'chat' ? renderChatItem(item.message) : renderConversationItem(item.message)}
    </View>
  );

  // Request card pinned at the start of the conversation (footer of an inverted list).
  const listStart = (
    <View>
      {chat.hasOlder ? (
        <Pressable onPress={() => void chat.loadOlder()} style={styles.loadOlder} disabled={chat.isLoadingOlder}>
          {chat.isLoadingOlder ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.loadOlderText, { color: colors.primary }]}>Load earlier messages</Text>
          )}
        </Pressable>
      ) : null}
      {pendingOffer ? (
        <IncomingRequestIntro
          offer={pendingOffer}
          secondsLeft={offerSecondsLeft}
          accepted={Boolean(acceptedOffer)}
          onPreviewImage={setPreviewUri}
        />
      ) : summary ? (
        <RequestCard
          summary={summary}
          badge={lifecycle.badge}
          cancelLabel={cancelLabel}
          cancelHint={lifecycle.cancellation === 'restricted' && isTechnician ? 'Needs admin review' : null}
          onCancel={startCancel}
          onPreviewImage={setPreviewUri}
        />
      ) : null}
      {awaitingTechnician ? (
        <View
          style={[styles.dispatchCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="chat-dispatch-status"
        >
          <View style={styles.dispatchRow}>
            {leftNegotiation ? (
              <View style={[styles.dispatchIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </View>
            ) : (
              <ProfileAvatar uri={routedAvatar} name={routedName} size={36} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.dispatchTitle, { color: colors.foreground }]}>
                {requestDelivered
                  ? `Request sent to ${routedName}`
                  : leftNegotiation
                    ? 'This technician is no longer on the job'
                  : proposalError && !routing
                    ? 'Your request was not delivered'
                    : `${routedName === 'the technician' ? 'The technician' : routedName} didn't accept`}
              </Text>
              <Text style={[styles.dispatchText, { color: colors.mutedForeground }]}>
                {requestDelivered
                  ? 'It is in their inbox now. They have a few minutes to accept; you will be notified here.'
                  : leftNegotiation
                    ? 'The negotiation ended before a price was agreed. Your booking fee still covers this job, so you can send it to another technician without paying again.'
                  : proposalError && !routing
                    ? proposalError
                    : routing?.status === 'EXPIRED'
                      ? 'The request timed out before they answered. Your booking fee still covers this job.'
                      : routing?.status === 'REJECTED'
                        ? 'They declined this request. Your booking fee still covers this job.'
                        : 'The request was declined or timed out. Your booking fee still covers this job.'}
              </Text>
              {!requestDelivered && feeValidityText ? (
                <Text style={[styles.dispatchText, { color: colors.mutedForeground }]}>{feeValidityText}</Text>
              ) : null}
            </View>
            {requestDelivered ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          {!requestDelivered ? (
            <>
              <Button
                label="Let Fundi find someone"
                size="small"
                onPress={() => void findAnotherTechnician()}
                loading={autoRouting}
                disabled={autoRouting}
                style={{ marginTop: 10 }}
                testID="chat-auto-route"
              />
              <View style={styles.dispatchActions}>
                {proposedTechnicianId && !leftNegotiation ? (
                  <Button label="Send again" size="small" variant="outline" onPress={() => void resendToSameTechnician()} disabled={autoRouting} style={{ flex: 1 }} />
                ) : null}
                <Button
                  label="Choose myself"
                  size="small"
                  variant="outline"
                  onPress={chooseAnotherTechnician}
                  disabled={autoRouting}
                  style={{ flex: 1 }}
                  testID="chat-choose-technician"
                />
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  // Kept to a word or two: next to three buttons on a narrow phone, anything longer wraps.
  const inputPlaceholder = !liveRoom
    ? pendingOffer
      ? 'Accept first'
      : 'Not open yet'
    : lockReason
      ? 'Chat closed'
      : feeBlocksClient
        ? feeStatus === 'checking' ? 'Checking…' : 'Pay to chat'
        : 'Message';

  const actionLabel = lifecycle.action ? ACTION_LABEL[lifecycle.action.kind] : null;
  const actionBusy =
    lifecycle.action?.kind === 'accept-request'
      ? workspace.busy === 'accept-request' || acceptingOffer
      : lifecycle.action?.kind === 'confirm-cooperation'
        ? workspace.busy === 'confirm'
        : lifecycle.action?.kind === 'start-job'
          ? workspace.busy === 'progress-IN_PROGRESS'
          : workspace.busy === 'complete';
  // Clients must pay before acting on the negotiation.
  const stepperActionAllowed = !(feeBlocksClient && lifecycle.action && lifecycle.action.kind !== 'confirm-completion');

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <BackButton onPress={goToList} />
        <Pressable
          disabled={!technicianProfileId}
          onPress={() => technicianProfileId && router.push(`/technician/${technicianProfileId}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`View ${otherName}'s profile`}
          style={styles.headerIdentity}
          testID="chat-header-identity"
        >
          <ProfileAvatar uri={otherAvatar} name={otherName} size={38} style={styles.headerAvatarWrap} testID="chat-header-avatar" />
          <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>{otherName}</Text>
          <View style={styles.headerSubRow}>
            {summary?.service ? (
              <View style={[styles.headerServicePill, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons name={getServiceIcon(summary.service) as any} size={11} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.headerServiceText, { color: colors.primary }]}>{summary.service}</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={[styles.headerJobStatus, { color: chat.otherTyping ? colors.primary : colors.mutedForeground }]}>
              {chat.otherTyping
                ? 'typing…'
                : lifecycle.isPriceAgreed && lifecycle.agreedAmount
                  ? `${lifecycle.currency} ${lifecycle.agreedAmount.toLocaleString()} agreed`
                  : awaitingTechnician
                    ? requestDelivered ? 'Request sent · awaiting reply' : 'Not assigned yet'
                    : isTechnician ? 'Client' : 'Your technician'}
            </Text>
          </View>
          </View>
        </Pressable>
        <View style={styles.headerActionsRow}>
          {otherPhone ? (
            <Pressable
              accessibilityLabel="Call"
              onPress={() => void Linking.openURL(`tel:${otherPhone}`)}
              style={[styles.headerIconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Ionicons name="call" size={17} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={chatDispute ? 'View dispute' : 'Report disagreement'}
            onPress={() => {
              if (chatDispute) setShowDisputeDetails(true);
              else setShowDisputeReport(true);
            }}
            style={[
              styles.headerIconBtn,
              {
                backgroundColor: chatDispute ? colors.primary + '20' : colors.secondary,
                borderColor: chatDispute ? colors.primary : colors.border,
              },
            ]}
          >
            <Feather name="shield" size={16} color={colors.primary} />
          </Pressable>
          <ProgressToggle
            expanded={progressOpen}
            onPress={() => setProgressOpen((open) => !open)}
            lifecycle={lifecycle}
          />
        </View>
      </View>

      {/* Active Dispute Banner */}
      {chatDispute ? (
        <Pressable
          onPress={() => setShowDisputeDetails(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 9,
            backgroundColor: colors.primary + '18',
            borderBottomWidth: 1,
            borderBottomColor: colors.primary + '30',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.primary }}>
              Dispute: {chatDispute.status.replace('_', ' ')} • Submitted to Web Admin
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: colors.primary }}>Details →</Text>
        </Pressable>
      ) : null}

      {/* Progress stepper */}
      <JobProgressStepper
        lifecycle={lifecycle}
        expanded={progressOpen}
        actionLabel={stepperActionAllowed ? actionLabel : null}
        onAction={lifecycle.action ? () => runLifecycleAction(lifecycle.action!) : undefined}
        actionBusy={actionBusy}
      />

      {/* Connection / sync state */}
      {room && (chat.socketStatus === 'disconnected' || chat.socketStatus === 'connecting') ? (
        <View style={[styles.connectionBar, { backgroundColor: colors.warning + '1A' }]} testID="chat-connection-banner">
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={[styles.connectionText, { color: colors.foreground }]}>
            {chat.socketStatus === 'connecting' ? 'Connecting…' : 'Reconnecting — messages will still sync.'}
          </Text>
        </View>
      ) : null}
      {chat.historyError || workspace.loadError ? (
        <Pressable
          onPress={() => {
            void chat.refresh();
            void workspace.refresh();
          }}
          style={[styles.connectionBar, { backgroundColor: colors.destructive + '14' }]}
        >
          <Ionicons name="refresh" size={14} color={colors.destructive} />
          <Text style={[styles.connectionText, { color: colors.foreground }]}>
            {chat.historyError ?? workspace.loadError} Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      {lockReason ? (
        <View style={styles.bannerPadding}>
          <Notice tone="warning" icon="lock-closed-outline" text={lockReason} />
        </View>
      ) : null}
      {firstMessage === 'true' && canMessage ? (
        <View style={styles.bannerPadding}>
          <Notice
            tone="success"
            icon="checkmark-circle-outline"
            text={isTechnician
              ? 'You are assigned to this job. Agree on a price with your client here.'
              : 'Booking fee paid. You can now message your technician and agree on a price.'}
          />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        inverted
        data={timeline}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListFooterComponent={listStart}
        contentContainerStyle={styles.messageList}
        onEndReached={() => void chat.loadOlder()}
        onEndReachedThreshold={0.2}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Booking fee gate (clients only) */}
      {feeBlocksClient && !lifecycle.isTerminal && jobId ? (
        <View style={[styles.lockedBanner, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {feeStatus === 'checking' ? (
            <View style={styles.lockedBannerTop}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.lockedBannerTitle, { color: colors.foreground, marginLeft: 10 }]}>Verifying your booking fee…</Text>
            </View>
          ) : feeStatus === 'unknown' ? (
            <>
              <Text style={[styles.lockedBannerTitle, { color: colors.foreground }]}>We couldn't confirm your booking fee payment.</Text>
              <Button label="Check again" size="small" variant="outline" onPress={() => void workspace.refresh()} style={{ marginTop: 10 }} />
            </>
          ) : (
            <>
              <View style={styles.lockedBannerTop}>
                <View style={[styles.lockedIconCircle, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.warning} />
                </View>
                <Text style={[styles.lockedBannerTitle, { color: colors.foreground, flex: 1, marginLeft: 10 }]}>
                  Booking fee pending. Complete payment to message and negotiate with this technician.
                </Text>
              </View>
              <Button
                label="Pay Booking Fee"
                icon="arrow-forward"
                testID="chat-pay-booking-fee-button"
                onPress={() =>
                  router.push({
                    pathname: '/checkout/payment',
                    params: {
                      requestId: jobId,
                      service: summary?.service ?? '',
                      ...(localJob?.bookingFee?.amount ? { amount: String(localJob.bookingFee.amount) } : {}),
                    },
                  })
                }
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </View>
      ) : null}

      {canRate ? (
        <RatingBar
          technicianName={otherName}
          state={ratingState}
          loading={ratingLoading}
          bottomInset={insets.bottom}
          onRate={(initialScore) => setRatingSheet({ initialScore })}
        />
      ) : pendingOffer && !acceptedOffer && !offerExpired ? (
        <View
          style={[
            styles.answerBar,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Button
            label="Decline"
            variant="outline"
            onPress={() => setDecliningOffer(true)}
            disabled={acceptingOffer}
            style={styles.flex1}
            testID="incoming-request-decline"
          />
          <Button
            label="Accept request"
            onPress={() => void acceptIncoming(pendingOffer)}
            loading={acceptingOffer}
            disabled={acceptingOffer}
            style={styles.flex1}
            testID="incoming-request-accept"
          />
        </View>
      ) : (
      /* Composer */
      <View
        style={[
          styles.inputBar,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          disabled={!canNegotiate}
          onPress={openOfferComposer}
          accessibilityLabel="Propose a price"
          testID="chat-offer-button"
          style={[styles.actionIconBtn, { backgroundColor: canNegotiate ? colors.primary + '18' : colors.muted, opacity: canNegotiate ? 1 : 0.6 }]}
        >
          <Feather name="tag" size={18} color={canNegotiate ? colors.primary : colors.mutedForeground} />
        </Pressable>
        <Pressable
          disabled={!canMessage}
          onPress={handleAttach}
          accessibilityLabel="Attach photo or document"
          testID="chat-attach-button"
          style={[styles.actionIconBtn, { backgroundColor: canMessage ? colors.primary + '18' : colors.muted, opacity: canMessage ? 1 : 0.6 }]}
        >
          <Feather name="paperclip" size={18} color={canMessage ? colors.primary : colors.mutedForeground} />
        </Pressable>
        <TextInput
          editable={canMessage}
          value={draft}
          onChangeText={handleChangeDraft}
          onBlur={() => chat.setTyping(false)}
          maxLength={CHAT_TEXT_MAX_LENGTH}
          multiline
          // Web renders a <textarea>; one row keeps it the same height as the buttons.
          {...(Platform.OS === 'web' ? { rows: 1 } : {})}
          onContentSizeChange={(event) => {
            const next = Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height)));
            setInputHeight((current) => (current === next ? current : next));
          }}
          placeholder={inputPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textInput,
            {
              height: draft ? inputHeight : INPUT_MIN_HEIGHT,
              // Scroll only once the text is taller than the box can grow.
              ...(Platform.OS === 'web' ? ({ overflowY: inputHeight >= INPUT_MAX_HEIGHT ? 'auto' : 'hidden' } as object) : {}),
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
              opacity: canMessage ? 1 : 0.6,
            },
          ]}
          testID="chat-message-input"
        />
        <Pressable
          disabled={!canMessage || !draft.trim()}
          onPress={handleSend}
          accessibilityLabel="Send message"
          testID="chat-send-button"
          style={[styles.sendBtn, { backgroundColor: canMessage && draft.trim() ? colors.primary : colors.muted }]}
        >
          <Ionicons name="send" size={18} color={canMessage && draft.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>
      )}

      <OfferSheet
        visible={Boolean(offerSheet)}
        mode={offerSheet?.mode ?? 'offer'}
        currency={lifecycle.currency}
        referenceAmount={offerSheet?.reference?.amount}
        remaining={remainingOffers}
        busy={workspace.busy === 'send-offer'}
        onClose={() => setOfferSheet(null)}
        onSubmit={async (amount, notes) => {
          await workspace.sendOffer(amount, notes);
        }}
      />
      <ReasonSheet
        visible={decliningOffer}
        title="Decline this request"
        description="The client will be able to choose another technician. A short reason helps them."
        confirmLabel="Decline request"
        required={false}
        busy={false}
        onClose={() => setDecliningOffer(false)}
        onSubmit={async (reason) => {
          if (!pendingOffer) return;
          await rejectOffer(pendingOffer.id, reason || 'Technician unavailable');
          goToList();
        }}
      />
      <ActionDialog request={dialog} onClose={() => setDialog(null)} />
      {canRate ? (
        <RatingSheet
          visible={Boolean(ratingSheet)}
          technicianName={otherName}
          state={ratingState}
          initialScore={ratingSheet?.initialScore}
          onClose={() => setRatingSheet(null)}
          onSubmit={async (input, existing) => {
            if (!jobId) return;
            const saved = existing ? await updateJobRating(jobId, input) : await submitJobRating(jobId, input);
            setRatingState((current) => (current ? { ...current, rating: saved } : { items: [], rating: saved }));
          }}
        />
      ) : null}
      <ReasonSheet
        visible={Boolean(reasonFlow)}
        title={reasonFlow ? reasonCopy[reasonFlow.flow].title : ''}
        description={reasonFlow ? reasonCopy[reasonFlow.flow].description : ''}
        confirmLabel={reasonFlow ? reasonCopy[reasonFlow.flow].confirm : ''}
        required={reasonFlow ? reasonCopy[reasonFlow.flow].required : true}
        busy={Boolean(workspace.busy)}
        onClose={() => setReasonFlow(null)}
        onSubmit={submitReason}
      />

      {previewUri ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <Pressable style={styles.fullscreenOverlay} onPress={() => setPreviewUri(null)}>
            <Image source={{ uri: previewUri }} style={styles.fullscreenImage} resizeMode="contain" />
            <Pressable style={styles.closePreviewBtn} onPress={() => setPreviewUri(null)}>
              <Feather name="x" size={24} color="#ffffff" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showDisputeReport && jobId ? (
        <ReportDisputeModal
          visible={showDisputeReport}
          onClose={() => setShowDisputeReport(false)}
          jobId={jobId}
          jobReference={localJob?.reference || (job as any)?.reference || jobId}
          service={job?.service || summary?.service || 'Service'}
          role={isTechnician ? 'technician' : 'client'}
          submitterName={viewerSide === 'TECHNICIAN' ? (account?.name || 'Technician') : (account?.name || 'Client')}
          submitterPhone={account?.phone || ''}
          clientName={isTechnician ? otherName : (account?.name || 'Client')}
          clientPhone={(isTechnician ? otherPhone : account?.phone) || ''}
          technicianName={isTechnician ? (account?.name || 'Technician') : otherName}
          technicianPhone={(isTechnician ? account?.phone : otherPhone) || ''}
          agreedPrice={lifecycle.agreedAmount ?? undefined}
          existingDispute={chatDispute}
        />
      ) : null}

      {showDisputeDetails && chatDispute ? (
        <DisputeDetailsModal
          visible={showDisputeDetails}
          onClose={() => setShowDisputeDetails(false)}
          dispute={chatDispute}
          currentRole={isTechnician ? 'technician' : 'client'}
          onOpenResponseModal={() => {
            setShowDisputeDetails(false);
            setShowDisputeReport(true);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  headerAvatarWrap: { marginLeft: 6, marginRight: 10 },
  dispatchIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dispatchCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  dispatchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dispatchTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  dispatchText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  dispatchActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  headerInfo: { flex: 1, justifyContent: 'center', minWidth: 0 },
  headerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerServicePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, maxWidth: 120 },
  headerServiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  headerJobStatus: { fontFamily: 'Inter_400Regular', fontSize: 12, flexShrink: 1 },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  connectionBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  connectionText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  bannerPadding: { paddingHorizontal: 16, paddingTop: 10 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' },
  centerText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  messageList: { paddingHorizontal: 16, paddingVertical: 16 },
  loadOlder: { alignItems: 'center', paddingVertical: 10 },
  loadOlderText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dateSeparatorWrap: { alignItems: 'center', marginVertical: 10 },
  dateSeparatorPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  dateSeparatorText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  systemWrap: { alignItems: 'center', marginVertical: 6 },
  systemBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '90%' },
  systemText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  systemTime: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  msgWrapper: { marginVertical: 3, maxWidth: '82%' },
  msgRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  chatBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  hiddenText: { fontStyle: 'italic' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
  bubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  failedText: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },
  chatPhoto: { width: 200, height: 200, borderRadius: 10 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  attachmentName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  attachmentDetail: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  lockedBanner: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  lockedBannerTop: { flexDirection: 'row', alignItems: 'center' },
  lockedIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  lockedBannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  // Buttons and the one-line box share one height; as the text grows the buttons stay on its last line.
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  actionIconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 16,
    // 10 + 20 + 10 plus the 1pt borders is exactly the 42pt button height.
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : {}),
  },
  answerBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  flex1: { flex: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '80%' },
  closePreviewBtn: { position: 'absolute', top: 48, right: 20, padding: 8 },
});

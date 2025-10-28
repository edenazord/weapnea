import { apiGet, apiSend } from "@/lib/apiClient";
import { backendConfig } from "@/lib/backendConfig";

export interface EventPaymentStats {
  eventId: string;
  totalPaidParticipants: number;
  totalRevenue: number;
}

export interface DashboardStats {
  totalEvents: number;
  totalPaidParticipants: number;
  totalRevenue: number;
  paymentsByEvent: EventPaymentStats[];
}

export const getOrganizerStats = async (organizerId: string): Promise<DashboardStats> => {
  const params = new URLSearchParams();
  if (organizerId) params.set('organizerId', organizerId);
  const res = await apiGet(`/api/payments/organizer-stats?${params.toString()}`);
  return res as DashboardStats;
};

type CheckoutResponse = { url?: string; free?: boolean };

type VerifyResponse = { success: boolean };

export const createEventCheckout = async (eventId: string, title?: string, amount?: number, slug?: string): Promise<{ url: string }> => {
  if (typeof amount !== 'number') throw new Error('amount richiesto in API mode');
  const res = await apiSend('/api/payments/create-checkout-session', 'POST', { eventId, title, amount, slug });
  if (!res?.url) throw new Error('Checkout URL non presente nella risposta');
  return { url: res.url };
};

export type CheckoutKind = 'event' | 'sponsor_package' | 'organizer_package';
export interface StartCheckoutInput {
  kind: CheckoutKind;
  id: string;
  title: string;
  amount: number;
  slug?: string;
}

export async function startCheckout(input: StartCheckoutInput): Promise<{ url: string }> {
  if (input.kind === 'event') {
    return createEventCheckout(input.id, input.title, input.amount, input.slug);
  }
  const res = await apiSend('/api/payments/create-package-checkout', 'POST', {
    kind: input.kind,
    packageId: input.id,
    packageName: input.title,
    amount: input.amount,
  });
  if (!res?.url) throw new Error('Checkout URL non presente nella risposta');
  return { url: res.url };
}

export const verifyEventPayment = async (_sessionId: string) => {
  // Placeholder: server webhook should update DB; if a verify endpoint is added, switch to it
  return { success: true } as VerifyResponse;
};

export interface EventParticipant {
  id: string;
  full_name: string;
  avatar_url?: string;
  company_name?: string;
  user_id: string;
  phone?: string | null;
  amount: number;
  paid_at: string;
}

export const getEventParticipants = async (eventId: string): Promise<EventParticipant[]> => {
  const rows = await apiGet(`/api/events/${encodeURIComponent(eventId)}/participants`);
  return rows as EventParticipant[];
};
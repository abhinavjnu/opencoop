import type {
  AuthResponse,
  Restaurant,
  MenuItem,
  Order,
  JobBoardEntry,
  Worker,
  WorkerDailyEarnings,
  Proposal,
  Vote,
  PoolState,
  PoolLedgerEntry,
  EscrowRecord,
  EventLogEntry,
  SystemParameters,
  Address,
  OrderItem,
  GeoLocation,
  ProposalCategory,
} from './types';

const TOKEN_KEY = 'opencoop_token';
const USER_KEY = 'opencoop_user';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  auth: {
    login(email: string, password: string): Promise<AuthResponse> {
      return post('/auth/login', { email, password });
    },
    register(data: {
      email: string;
      password: string;
      name: string;
      phone: string;
      role: string;
    }): Promise<AuthResponse> {
      return post('/auth/register', data);
    },
  },

  restaurants: {
    list(): Promise<Restaurant[]> {
      return get('/restaurants');
    },
    get(id: string): Promise<Restaurant> {
      return get(`/restaurants/${id}`);
    },
    getMenu(id: string): Promise<MenuItem[]> {
      return get(`/restaurants/${id}/menu`);
    },
    getOrders(id: string): Promise<Order[]> {
      return get(`/restaurants/${id}/orders`);
    },
    updateStatus(id: string, isOpen: boolean): Promise<{ isOpen: boolean }> {
      return put(`/restaurants/${id}/status`, { isOpen });
    },
    addMenuItem(
      restaurantId: string,
      item: { name: string; description: string; price: number; category: string; isAvailable?: boolean },
    ): Promise<{ id: string }> {
      return post(`/restaurants/${restaurantId}/menu`, item);
    },
    updateMenuItem(
      restaurantId: string,
      itemId: string,
      item: Partial<MenuItem>,
    ): Promise<{ success: boolean }> {
      return put(`/restaurants/${restaurantId}/menu/${itemId}`, item);
    },
  },

  orders: {
    create(data: {
      restaurantId: string;
      items: OrderItem[];
      deliveryAddress: Address;
      tip?: number;
    }): Promise<{ orderId: string; subtotal: number; deliveryFee: number; tip: number; total: number; status: string; transparency: { restaurantReceives: number; workerReceives: number; coopInfraFee: number; poolContribution: number } }> {
      return post('/orders', data);
    },
    list(): Promise<Order[]> {
      return get('/orders');
    },
    get(id: string): Promise<Order> {
      return get(`/orders/${id}`);
    },
    accept(id: string, estimatedPrepTime: number): Promise<Order> {
      return post(`/orders/${id}/accept`, { estimatedPrepTime });
    },
    reject(id: string, reason: string): Promise<Order> {
      return post(`/orders/${id}/reject`, { reason });
    },
    claim(id: string, workerLocation: GeoLocation): Promise<Order> {
      return post(`/orders/${id}/claim`, { workerLocation });
    },
    pickup(id: string, workerLocation: GeoLocation): Promise<Order> {
      return post(`/orders/${id}/pickup`, { workerLocation });
    },
    deliver(id: string, data: {
      workerLocation: GeoLocation;
      proofPhotoUrl?: string;
      signatureConfirmation?: boolean;
    }): Promise<Order> {
      return post(`/orders/${id}/deliver`, data);
    },
    cancel(id: string, reason: string): Promise<Order> {
      return post(`/orders/${id}/cancel`, { reason });
    },
  },

  workers: {
    me(): Promise<Worker> {
      return get('/workers/me');
    },
    jobs(): Promise<JobBoardEntry[]> {
      return get('/workers/jobs');
    },
    goOnline(location: GeoLocation, zone?: string): Promise<Worker> {
      return post('/workers/online', { location, zone });
    },
    goOffline(reason?: string): Promise<Worker> {
      return post('/workers/offline', { reason });
    },
    updateLocation(location: GeoLocation): Promise<{ success: boolean }> {
      return post('/workers/location', { location });
    },
    earnings(): Promise<WorkerDailyEarnings[]> {
      return get('/workers/earnings');
    },
    earningsToday(): Promise<WorkerDailyEarnings> {
      return get('/workers/earnings/today');
    },
  },

  governance: {
    proposals(): Promise<Proposal[]> {
      return get('/governance/proposals');
    },
    activeProposals(): Promise<Proposal[]> {
      return get('/governance/proposals/active');
    },
    getProposal(id: string): Promise<Proposal & { votes: Vote[] }> {
      return get(`/governance/proposals/${id}`);
    },
    createProposal(data: {
      title: string;
      description: string;
      category: ProposalCategory;
      parameterChange?: {
        parameter: string;
        currentValue: unknown;
        proposedValue: unknown;
      };
    }): Promise<{ proposalId: string; votingEndsAt: string }> {
      return post('/governance/proposals', data);
    },
    vote(proposalId: string, vote: 'for' | 'against' | 'abstain'): Promise<Vote> {
      return post(`/governance/proposals/${proposalId}/vote`, { vote });
    },
    parameters(): Promise<SystemParameters> {
      return get('/governance/parameters');
    },
  },

  escrow: {
    poolState(): Promise<PoolState> {
      return get('/escrow/pool');
    },
    poolLedger(limit = 50): Promise<PoolLedgerEntry[]> {
      return get(`/escrow/pool/ledger?limit=${limit}`);
    },
    getByOrder(orderId: string): Promise<EscrowRecord> {
      return get(`/escrow/order/${orderId}`);
    },
  },

  events: {
    recent(limit = 50): Promise<EventLogEntry[]> {
      return get(`/events/recent?limit=${limit}`);
    },
    byAggregate(type: string, id: string): Promise<EventLogEntry[]> {
      return get(`/events/aggregate/${type}/${id}`);
    },
    verify(type: string, id: string): Promise<{ valid: boolean; checkedCount: number }> {
      return get(`/events/verify/${type}/${id}`);
    },
  },
};

export function setAuth(token: string, user: { userId: string; email: string; name?: string; role: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): { userId: string; email: string; name?: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return getToken();
}

export { clearAuth };

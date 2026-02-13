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

const TOKEN_KEY = 'openfood_token';
const USER_KEY = 'openfood_user';
const LEGACY_TOKEN_KEY = 'opencoop_token';
const LEGACY_USER_KEY = 'opencoop_user';

type RawRestaurant = Record<string, unknown>;
type RawWorker = Record<string, unknown>;
type RawOrder = Record<string, unknown>;

function mapRestaurant(raw: RawRestaurant): Restaurant {
  return {
    id: String(raw['id']),
    userId: String(raw['userId']),
    name: String(raw['name']),
    description: String(raw['description'] ?? ''),
    address: {
      street: String(raw['street'] ?? ''),
      city: String(raw['city'] ?? ''),
      postalCode: String(raw['postalCode'] ?? ''),
      lat: Number(raw['lat'] ?? 0),
      lng: Number(raw['lng'] ?? 0),
    },
    phone: String(raw['phone'] ?? ''),
    isOpen: Boolean(raw['isOpen']),
    openingHours: (raw['openingHours'] as Record<string, { open: string; close: string } | null> | undefined) ?? {},
    averagePrepTime: Number(raw['averagePrepTime'] ?? 20),
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
  };
}

function mapWorker(raw: RawWorker): Worker {
  const hasCoordinates = raw['currentLat'] !== null && raw['currentLat'] !== undefined && raw['currentLng'] !== null && raw['currentLng'] !== undefined;

  return {
    id: String(raw['id']),
    userId: String(raw['userId']),
    name: String(raw['name']),
    phone: String(raw['phone'] ?? ''),
    vehicleType: raw['vehicleType'] as Worker['vehicleType'],
    zone: String(raw['zone'] ?? ''),
    isOnline: Boolean(raw['isOnline']),
    currentLocation: hasCoordinates ? { lat: Number(raw['currentLat']), lng: Number(raw['currentLng']) } : null,
    totalDeliveries: Number(raw['totalDeliveries'] ?? 0),
    averageRating: Number(raw['averageRating'] ?? 0),
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
  };
}

function mapOrder(raw: RawOrder): Order {
  return {
    id: String(raw['id']),
    customerId: String(raw['customerId']),
    restaurantId: String(raw['restaurantId']),
    workerId: raw['workerId'] ? String(raw['workerId']) : null,
    items: (raw['items'] as OrderItem[] | undefined) ?? [],
    subtotal: Number(raw['subtotal'] ?? 0),
    deliveryFee: Number(raw['deliveryFee'] ?? 0),
    tip: Number(raw['tip'] ?? 0),
    total: Number(raw['total'] ?? 0),
    status: raw['status'] as Order['status'],
    deliveryAddress: {
      street: String(raw['deliveryStreet'] ?? ''),
      city: String(raw['deliveryCity'] ?? ''),
      postalCode: String(raw['deliveryPostalCode'] ?? ''),
      lat: Number(raw['deliveryLat'] ?? 0),
      lng: Number(raw['deliveryLng'] ?? 0),
    },
    pickupAddress: {
      street: String(raw['pickupStreet'] ?? ''),
      city: String(raw['pickupCity'] ?? ''),
      postalCode: String(raw['pickupPostalCode'] ?? ''),
      lat: Number(raw['pickupLat'] ?? 0),
      lng: Number(raw['pickupLng'] ?? 0),
    },
    estimatedPrepTime: raw['estimatedPrepTime'] === null || raw['estimatedPrepTime'] === undefined ? null : Number(raw['estimatedPrepTime']),
    estimatedDeliveryTime: raw['estimatedDeliveryTime'] === null || raw['estimatedDeliveryTime'] === undefined ? null : Number(raw['estimatedDeliveryTime']),
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
    updatedAt: String(raw['updatedAt'] ?? new Date().toISOString()),
  };
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyToken) return null;

  localStorage.setItem(TOKEN_KEY, legacyToken);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  return legacyToken;
}

function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
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

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
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
      return get<RawRestaurant[]>('/restaurants').then((rows) => rows.map(mapRestaurant));
    },
    get(id: string): Promise<Restaurant> {
      return get<RawRestaurant>(`/restaurants/${id}`).then(mapRestaurant);
    },
    getMenu(id: string): Promise<MenuItem[]> {
      return get(`/restaurants/${id}/menu`);
    },
    getOrders(id: string): Promise<Order[]> {
      return get<RawOrder[]>(`/restaurants/${id}/orders`).then((rows) => rows.map(mapOrder));
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
      return get<RawOrder[]>('/orders').then((rows) => rows.map(mapOrder));
    },
    get(id: string): Promise<Order> {
      return get<RawOrder>(`/orders/${id}`).then(mapOrder);
    },
    accept(id: string, estimatedPrepTime: number): Promise<{ orderId: string; status: string; estimatedPrepTime: number }> {
      return post(`/orders/${id}/accept`, { estimatedPrepTime });
    },
    reject(id: string, reason: string): Promise<{ orderId: string; status: string; reason: string }> {
      return post(`/orders/${id}/reject`, { reason });
    },
    claim(id: string, workerLocation: GeoLocation): Promise<{ orderId: string; status: string; workerId: string }> {
      return post(`/orders/${id}/claim`, { workerLocation });
    },
    pickup(id: string, workerLocation: GeoLocation): Promise<{ orderId: string; status: string }> {
      return post(`/orders/${id}/pickup`, { workerLocation });
    },
    deliver(id: string, data: {
      workerLocation: GeoLocation;
      proofPhotoUrl?: string;
      signatureConfirmation?: boolean;
    }): Promise<{ orderId: string; status: string }> {
      return post(`/orders/${id}/deliver`, data);
    },
    cancel(id: string, reason: string): Promise<{ orderId: string; status: string; reason: string }> {
      return post(`/orders/${id}/cancel`, { reason });
    },
  },

  workers: {
    me(): Promise<Worker> {
      return get<RawWorker>('/workers/me').then(mapWorker);
    },
    jobs(): Promise<JobBoardEntry[]> {
      return get('/workers/jobs');
    },
    goOnline(location: GeoLocation, zone?: string): Promise<{ workerId: string; isOnline: boolean }> {
      return post('/workers/online', { location, zone });
    },
    goOffline(reason?: string): Promise<{ workerId: string; isOnline: boolean }> {
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
    activeOrder(): Promise<Order | null> {
      return get<RawOrder | null>('/workers/orders/active').then((order) => (order ? mapOrder(order) : null));
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
    tally(proposalId: string): Promise<{ proposalId: string; status: string; votesFor: number; votesAgainst: number; abstentions: number; quorumPercent: number; quorumReached: boolean }> {
      return post(`/governance/proposals/${proposalId}/tally`);
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
  let raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    const legacyRaw = localStorage.getItem(LEGACY_USER_KEY);
    if (legacyRaw) {
      localStorage.setItem(USER_KEY, legacyRaw);
      localStorage.removeItem(LEGACY_USER_KEY);
      raw = legacyRaw;
    }
  }

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

import { clearStoredAuth, getAuthToken, type AuthUser } from "./auth-storage";

export type Photo = {
  _id: string;
  imageUrl?: string;
  folder?: string;
  event?: string | null;
  analyzed?: boolean;
  // Backward-compat fields for older photo documents/responses.
  filename?: string;
  path?: string;
  detectedPersons?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UploadedFace = {
  faceId: string;
  orderIndex?: number;
  box: FaceBox;
  confidence: number;
  personId: string | null;
  name: string;
  learningConfirmed?: boolean;
  faceMatchStatus?: "matched" | "ambiguous" | "unknown";
  similarity?: number;
  secondBestSimilarity?: number;
  similarityGap?: number;
  candidateNames?: Array<{
    name: string;
    similarity: number;
  }>;
};

export type UploadedPhoto = {
  photoId: string;
  imageUrl?: string;
  event?: string | null;
  faceOrder?: "left_to_right" | "right_to_left";
  faces: UploadedFace[];
};

export type PersonSummary = {
  personId: string;
  name: string;
  email?: string;
  photos: number;
  sampleImageUrl?: string;
  lastLabeledAt?: string;
};

export type AuthResponse = {
  success: boolean;
  user: AuthUser;
  token: string;
};

export type DeliveryRecord = {
  _id: string;
  person: string;
  type: "email" | "whatsapp" | "direct_link";
  recipientEmail?: string;
  subject?: string;
  message?: string;
  photoLinks?: string[];
  status?: "pending" | "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryStats = {
  total: number;
  byStatus: {
    pending: number;
    sent: number;
    failed: number;
  };
  byType: {
    email: number;
    whatsapp: number;
    direct_link: number;
  };
};

export type ChatHistoryEntry = {
  _id: string;
  ownerId: string;
  prompt: string;
  command: string;
  status: "success" | "failed";
  agentDecision: Record<string, unknown> | null;
  assistant: {
    action: string;
    message: string;
    data?: {
      photos?: Photo[];
      delivery?: Record<string, unknown>;
      navigate?: boolean;
      targetUrl?: string;
      [key: string]: unknown;
    } | null;
  };
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiError = {
  message?: string;
};

type ApiFetchOptions = {
  skipAuth?: boolean;
  preserveAuthOnUnauthorized?: boolean;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";
const IS_DEV = import.meta.env.DEV;

const debugLog = (message: string, payload?: unknown) => {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.debug(`[api] ${message}`);
    return;
  }
  console.debug(`[api] ${message}`, payload);
};

const withAuthHeader = (headersInput: HeadersInit | undefined, skipAuth: boolean) => {
  const headers = new Headers(headersInput || undefined);
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
};

const apiFetch = async <T>(endpoint: string, init?: RequestInit, options?: ApiFetchOptions): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = init?.method || "GET";
  const skipAuth = Boolean(options?.skipAuth);
  const headers = withAuthHeader(init?.headers, skipAuth);
  debugLog("request:start", { method, url });

  const response = await fetch(url, {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    try {
      parsedBody = JSON.parse(responseText);
    } catch (_err) {
      parsedBody = null;
    }
  }

  debugLog("request:end", {
    method,
    url,
    status: response.status,
    ok: response.ok,
    body: parsedBody ?? responseText ?? null,
  });

  if (!response.ok) {
    if (response.status === 401 && !options?.preserveAuthOnUnauthorized) {
      clearStoredAuth();
    }

    const errorBody = parsedBody as ApiError | null;
    const fallbackText = responseText?.trim();
    const message =
      errorBody?.message ||
      fallbackText ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return (parsedBody as T) ?? ({} as T);
};

export const getApiBaseUrl = () => API_BASE_URL;

export const signupApi = async (payload: { name: string; email: string; password: string }) => {
  return apiFetch<AuthResponse>(
    "/api/auth/signup",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { skipAuth: true, preserveAuthOnUnauthorized: true }
  );
};

export const loginApi = async (payload: { email: string; password: string }) => {
  return apiFetch<AuthResponse>(
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { skipAuth: true, preserveAuthOnUnauthorized: true }
  );
};

export const getMeApi = async () => {
  return apiFetch<{ success: boolean; user: AuthUser }>("/api/auth/me");
};

export const uploadPhotosApi = async (
  files: File[],
  faceOrder: "left_to_right" | "right_to_left" = "left_to_right",
  event?: string
) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("photos", file);
  });
  formData.append("faceOrder", faceOrder);
  const trimmedEvent = String(event || "").trim();
  if (trimmedEvent) {
    formData.append("event", trimmedEvent);
  }

  debugLog(
    "upload:files",
    files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    }))
  );

  return apiFetch<{ message: string; count: number; photos: UploadedPhoto[] }>("/api/upload", {
    method: "POST",
    body: formData,
  });
};

export const labelFaceApi = async (faceId: string, name: string) => {
  return apiFetch<{
    success: boolean;
    faceId: string;
    personId: string;
    name: string;
    learningConfirmed?: boolean;
  }>("/api/label-face", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ faceId, name }),
  });
};

export const confirmPhotoLabelsApi = async (photoId: string) => {
  return apiFetch<{
    success: boolean;
    photoId: string;
    confirmedCount: number;
    confirmedFaceIds: string[];
    peopleUpdated: number;
  }>("/api/confirm-photo-labels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ photoId }),
  });
};

export const manualFaceLabelApi = async (payload: {
  photoId: string;
  box: FaceBox;
  name: string;
}) => {
  return apiFetch<{
    success: boolean;
    face?: {
      faceId: string;
      box: FaceBox;
      personId: string;
      name: string;
      confidence: number;
      learningConfirmed: boolean;
    };
  }>("/api/manual-face", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getPhotosApi = async (filters?: {
  person?: string;
  event?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const params = new URLSearchParams();

  if (filters?.person?.trim()) {
    params.set("person", filters.person.trim());
  }

  if (filters?.event?.trim()) {
    params.set("event", filters.event.trim());
  }

  if (filters?.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim());
  }

  if (filters?.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim());
  }

  const query = params.toString();
  const endpoint = query ? `/api/photos?${query}` : "/api/photos";

  return apiFetch<{ photos: Photo[]; count: number }>(endpoint);
};

export const deletePhotoApi = async (photoId: string) => {
  return apiFetch<{ success: boolean; message: string }>(`/api/photos/${photoId}`, {
    method: "DELETE",
  });

};

export const getPeopleApi = async () => {
  return apiFetch<{ people: PersonSummary[]; count: number }>("/api/people");
};

export const createPersonApi = async (name: string, photo: File, email?: string) => {
  const formData = new FormData();
  formData.append("name", name);
  if (String(email || "").trim()) {
    formData.append("email", String(email).trim());
  }
  formData.append("photo", photo);

  return apiFetch<{
    success: boolean;
    person: PersonSummary;
  }>("/api/people", {
    method: "POST",
    body: formData,
  });
};

export const chatWithAgentApi = async (message: string) => {
  return apiFetch<{
    success: boolean;
    agentDecision: Record<string, unknown>;
    result: {
      action: string;
      message: string;
      data?: {
        photos?: Photo[];
        delivery?: Record<string, unknown>;
        navigate?: boolean;
        targetUrl?: string;
        personId?: string;
        person?: string;
        photoCount?: number;
        requiresEmail?: boolean;
        recipientEmail?: string;
      };
    };
  }>("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
};

export const getChatHistoryApi = async (limit = 50) => {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
  return apiFetch<{
    success: boolean;
    count: number;
    history: ChatHistoryEntry[];
  }>(`/api/chat/history?limit=${safeLimit}`);
};

export const sendChatPhotosEmailApi = async (payload: {
  personId?: string;
  person?: string;
  recipientName?: string;
  recipientEmail: string;
  count?: number;
}) => {
  return apiFetch<{
    success: boolean;
    result: {
      action: string;
      message: string;
      data?: {
        photos?: Photo[];
        personId?: string;
        person?: string;
        recipientEmail?: string;
      };
    };
  }>("/api/chat/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const sendDeliveryEmailApi = async (payload: {
  person: string;
  recipientEmail: string;
  subject?: string;
  message: string;
  photoLinks?: string[];
}) => {
  return apiFetch<{
    success: boolean;
    message: string;
    delivery: DeliveryRecord;
  }>("/api/deliveries/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getDeliveriesApi = async (filters?: {
  statuses?: Array<"pending" | "sent" | "failed">;
  types?: Array<"email" | "whatsapp" | "direct_link">;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.statuses && filters.statuses.length > 0) {
    params.set("statuses", filters.statuses.join(","));
  }
  if (filters?.types && filters.types.length > 0) {
    params.set("types", filters.types.join(","));
  }
  if (filters?.limit && Number.isFinite(filters.limit)) {
    params.set("limit", String(filters.limit));
  }
  const query = params.toString();
  const endpoint = query ? `/api/deliveries?${query}` : "/api/deliveries";

  return apiFetch<{
    success: boolean;
    count: number;
    deliveries: DeliveryRecord[];
    stats: DeliveryStats;
  }>(endpoint);
};

export const createDeliveryApi = async (payload: {
  person: string;
  type: "email" | "whatsapp" | "direct_link";
  status?: "pending" | "sent" | "failed";
  recipientEmail?: string;
  subject?: string;
  message?: string;
  photoLinks?: string[];
}) => {
  return apiFetch<{
    success: boolean;
    message: string;
    delivery: DeliveryRecord;
  }>("/api/deliveries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const updateDeliveryStatusApi = async (
  deliveryId: string,
  payload: { status: "pending" | "sent" | "failed"; errorMessage?: string; providerMessageId?: string }
) => {
  return apiFetch<{
    success: boolean;
    message: string;
    delivery: DeliveryRecord;
  }>(`/api/deliveries/${deliveryId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

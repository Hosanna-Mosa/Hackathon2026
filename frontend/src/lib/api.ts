export type Photo = {
  _id: string;
  imageUrl?: string;
  folder?: string;
  // Backward-compat fields for older photo documents/responses.
  filename?: string;
  path?: string;
  detectedPersons: string[];
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
  faceOrder?: "left_to_right" | "right_to_left";
  faces: UploadedFace[];
};

export type PersonSummary = {
  personId: string;
  name: string;
  photos: number;
  sampleImageUrl?: string;
  lastLabeledAt?: string;
};

type ApiError = {
  message?: string;
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

const apiFetch = async <T>(endpoint: string, init?: RequestInit): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = init?.method || "GET";
  debugLog("request:start", { method, url });

  const response = await fetch(url, init);
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

export const uploadPhotosApi = async (
  files: File[],
  faceOrder: "left_to_right" | "right_to_left" = "left_to_right"
) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("photos", file);
  });
  formData.append("faceOrder", faceOrder);

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

export const getPhotosApi = async (filters?: {
  person?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const params = new URLSearchParams();

  if (filters?.person?.trim()) {
    params.set("person", filters.person.trim());
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

export const getPeopleApi = async () => {
  return apiFetch<{ people: PersonSummary[]; count: number }>("/api/people");
};

export const createPersonApi = async (name: string, photo: File) => {
  const formData = new FormData();
  formData.append("name", name);
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

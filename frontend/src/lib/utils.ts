import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolvePhotoUrl(pathOrUrl?: string, filename?: string) {
  const baseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:8000";

  if (!pathOrUrl && filename) {
    return `${baseUrl}/uploads/${filename}`;
  }

  if (pathOrUrl?.startsWith("http://") || pathOrUrl?.startsWith("https://")) {
    return pathOrUrl;
  }

  if (pathOrUrl?.startsWith("/uploads/")) {
    return `${baseUrl}${pathOrUrl}`;
  }

  if (pathOrUrl?.includes("/uploads/") || pathOrUrl?.includes("\\uploads\\")) {
    const normalized = pathOrUrl.replace(/\\/g, "/");
    const name = normalized.split("/").pop();
    if (name) {
      return `${baseUrl}/uploads/${name}`;
    }
  }

  if (filename) {
    return `${baseUrl}/uploads/${filename}`;
  }

  return pathOrUrl || "";
}

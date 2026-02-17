import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Lock, Unlock, Download, Trash2, X } from "lucide-react";
import { deletePhotoApi, getPhotosApi, type Photo, updatePhotoPrivacyApi } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const PrivateGallery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEvent = useMemo(() => (searchParams.get("event") || "").trim(), [searchParams]);
  const queryDate = useMemo(() => (searchParams.get("date") || "").trim(), [searchParams]);
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [updatingPhotoId, setUpdatingPhotoId] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const PRIVATE_GALLERY_PASSWORD = String(import.meta.env.VITE_PRIVATE_GALLERY_PASSWORD || "1234");

  const loadPhotos = useCallback(async (filtersInput?: { event?: string; dateFrom?: string; dateTo?: string }) => {
    try {
      setLoading(true);
      setError("");
      const data = await getPhotosApi({
        ...filtersInput,
        privateOnly: true,
      });
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load private photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }
    setEvent(queryEvent);
    setDate(queryDate);
    void loadPhotos({
      event: queryEvent || undefined,
      dateFrom: queryDate || undefined,
      dateTo: queryDate || undefined,
    });
  }, [isUnlocked, loadPhotos, queryDate, queryEvent]);

  const onUnlock = () => {
    if (passwordInput === PRIVATE_GALLERY_PASSWORD) {
      setPasswordError("");
      setIsUnlocked(true);
      return;
    }
    setPasswordError("Incorrect lock password.");
  };

  if (!isUnlocked) {
    return (
      <div className="animate-fade-in mx-auto mt-20 max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-foreground">Private Gallery Lock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the lock password to access private photos.
        </p>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUnlock();
            }
          }}
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
          placeholder="Enter password"
        />
        {passwordError && <p className="mt-2 text-xs text-destructive">{passwordError}</p>}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onUnlock}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Unlock
          </button>
          <button
            type="button"
            onClick={() => navigate("/gallery")}
            className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const onApplyFilters = () => {
    const next = new URLSearchParams();
    const eventValue = event.trim();
    const dateValue = date.trim();
    if (eventValue) next.set("event", eventValue);
    if (dateValue) next.set("date", dateValue);
    setSearchParams(next);
  };

  const onClearFilters = () => {
    setEvent("");
    setDate("");
    setSearchParams({});
  };

  const onTogglePrivacy = async (photo: Photo, isPrivate: boolean) => {
    try {
      setUpdatingPhotoId(photo._id);
      await updatePhotoPrivacyApi(photo._id, isPrivate);
      if (!isPrivate) {
        setPhotos((prev) => prev.filter((item) => item._id !== photo._id));
        if (selectedPhoto?._id === photo._id) {
          setSelectedPhoto(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update photo privacy.");
    } finally {
      setUpdatingPhotoId(null);
    }
  };

  const onDeletePhoto = async (photo: Photo) => {
    if (!window.confirm("Delete this private photo?")) return;
    try {
      await deletePhotoApi(photo._id);
      setPhotos((prev) => prev.filter((item) => item._id !== photo._id));
      if (selectedPhoto?._id === photo._id) {
        setSelectedPhoto(null);
      }
    } catch (_err) {
      setError("Failed to delete photo.");
    }
  };

  const onDownload = async (photo: Photo) => {
    try {
      const url = resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = photo.filename || `photo-${photo._id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (_err) {
      setError("Failed to download photo.");
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Private Gallery</h1>
          <p className="text-sm text-muted-foreground">Only photos marked private are shown here.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/gallery")}
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Back to Gallery
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="Filter by event"
          className="w-44 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
        />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 bg-transparent px-1 py-1 text-sm text-foreground outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onApplyFilters}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Clear
        </button>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading private photos...</p>}
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!loading && !error && photos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No private photos yet. Open Gallery and mark photos as private.
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, i) => (
            <div
              key={photo._id || `${photo.imageUrl || photo.filename || "photo"}-${i}`}
              className="group relative cursor-pointer overflow-hidden rounded-xl"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                alt={`Private photo ${i + 1}`}
                className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white">
                <Lock className="mr-1 inline h-3 w-3" />
                Private
              </div>
              <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Make public"
                  disabled={updatingPhotoId === photo._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onTogglePrivacy(photo, false);
                  }}
                  className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-60"
                >
                  <Unlock className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Download"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDownload(photo);
                  }}
                  className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDeletePhoto(photo);
                  }}
                  className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-destructive/80"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-6 top-6 z-50 rounded-full bg-black/20 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-8 w-8" />
          </button>
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={resolvePhotoUrl(selectedPhoto.imageUrl || selectedPhoto.path, selectedPhoto.filename)}
              alt="Private preview"
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateGallery;

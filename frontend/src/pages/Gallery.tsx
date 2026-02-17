import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Calendar, SlidersHorizontal, Upload, MessageCircle, X, ZoomIn, ZoomOut, Download, Trash2, Maximize2, PartyPopper } from "lucide-react";
import { getPhotosApi, deletePhotoApi, type Photo } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const filters = [
  { icon: Users, label: "Person" },
  { icon: PartyPopper, label: "Event" },
  { icon: Calendar, label: "Date" },
];

const Gallery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPerson = useMemo(() => (searchParams.get("person") || "").trim(), [searchParams]);
  const queryEvent = useMemo(() => (searchParams.get("event") || "").trim(), [searchParams]);
  const queryDate = useMemo(() => (searchParams.get("date") || "").trim(), [searchParams]);
  const [person, setPerson] = useState("");
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const loadPhotos = useCallback(async (filtersInput?: { person?: string; dateFrom?: string; dateTo?: string }) => {
    try {
      setLoading(true);
      setError("");
      const data = await getPhotosApi(filtersInput);
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPerson(queryPerson);
    setEvent(queryEvent);
    setDate(queryDate);
    void loadPhotos({
      person: queryPerson || undefined,
      event: queryEvent || undefined,
      dateFrom: queryDate || undefined,
      dateTo: queryDate || undefined,
    });
  }, [loadPhotos, queryDate, queryEvent, queryPerson]);

  const onApplyFilters = () => {
    const next = new URLSearchParams();
    const personValue = person.trim();
    const eventValue = event.trim();
    const dateValue = date.trim();

    if (personValue) {
      next.set("person", personValue);
    }
    if (eventValue) {
      next.set("event", eventValue);
    }
    if (dateValue) {
      next.set("date", dateValue);
    }

    setSearchParams(next);
  };

  const onClearFilters = () => {
    setPerson("");
    setEvent("");
    setDate("");
    setSearchParams({});
  };

  const photosGroupedByDate = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    for (const photo of photos) {
      const dateValue = photo.createdAt ? new Date(photo.createdAt) : null;
      const validDate = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : null;
      const key = validDate
        ? validDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        : "Unknown Date";
      const current = groups.get(key) || [];
      current.push(photo);
      groups.set(key, current);
    }
    return Array.from(groups.entries());
  }, [photos]);

  const handleDownload = async (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
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
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this photo?")) return;
    try {
      await deletePhotoApi(photo._id);
      setPhotos((prev) => prev.filter((p) => p._id !== photo._id));
      if (selectedPhoto?._id === photo._id) {
        setSelectedPhoto(null);
      }
    } catch (err) {
      setError("Failed to delete photo");
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
    setZoomLevel(1);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Filter by person"
              className="w-40 bg-transparent px-2 py-1 text-sm text-foreground outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
            <PartyPopper className="h-4 w-4 text-muted-foreground" />
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="Filter by event"
              className="w-40 bg-transparent px-2 py-1 text-sm text-foreground outline-none"
            />
          </div>
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
          {/* {filters.map((f) => (
            <span
              key={f.label}
              className="hidden items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground lg:inline-flex"
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </span>
          ))} */}
          <button className="flex items-center gap-2 text-sm font-medium text-primary" type="button">
            <SlidersHorizontal className="h-4 w-4" />
            Latest First
          </button>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          type="button"
          onClick={() => navigate("/upload")}
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading photos...</p>}
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!loading && !error && photos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No photos found. Upload images from Upload Center to populate your gallery.
        </div>
      )}

      <div className="space-y-6">
        {photosGroupedByDate.map(([dateLabel, groupedPhotos]) => (
          <section key={dateLabel}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{dateLabel}</h3>
              <span className="text-xs text-muted-foreground">
                {groupedPhotos.length} photo{groupedPhotos.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupedPhotos.map((photo, i) => (
                <div
                  key={photo._id || `${photo.imageUrl || photo.filename || "photo"}-${i}`}
                  className="group relative overflow-hidden rounded-xl cursor-pointer"
                  onClick={() => handlePhotoClick(photo)}
                >
                  <img
                    src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                    alt={`Gallery photo ${i + 1}`}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Action Buttons on Card */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleDownload(e, photo)}
                      className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, photo)}
                      className="rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-destructive/80"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {photo.detectedPersons?.[0] && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground">
                      {photo.detectedPersons[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
        type="button"
        onClick={() => navigate("/assistant")}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
      </button>
      {/* Image Zoom Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-6 top-6 z-50 rounded-full bg-black/20 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-8 w-8" />
          </button>

          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvePhotoUrl(selectedPhoto.imageUrl || selectedPhoto.path, selectedPhoto.filename)}
              alt="Zoomed view"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease-out',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              className="object-contain shadow-2xl"
              onWheel={(e) => {
                if (e.deltaY < 0) {
                  setZoomLevel((prev) => Math.min(prev + 0.1, 4));
                } else {
                  setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
                }
              }}
            />
          </div>

          <div
            className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/60 px-6 py-3 backdrop-blur-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleZoomOut}
              className="p-2 text-white/80 transition-colors hover:text-white disabled:opacity-50"
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="min-w-[3rem] text-center text-sm font-medium text-white">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-white/80 transition-colors hover:text-white disabled:opacity-50"
              disabled={zoomLevel >= 4}
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            <div className="mx-2 h-6 w-px bg-white/20" />

            <button
              onClick={(e) => handleDownload(e, selectedPhoto)}
              className="p-2 text-white/80 transition-colors hover:text-white"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => handleDelete(e, selectedPhoto)}
              className="p-2 text-white/80 transition-colors hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;

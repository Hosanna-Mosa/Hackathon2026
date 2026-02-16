import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Calendar, SlidersHorizontal, Upload, MessageCircle } from "lucide-react";
import { getPhotosApi, type Photo } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const filters = [
  { icon: Users, label: "Person" },
  { icon: Calendar, label: "Date" },
];

const Gallery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPerson = useMemo(() => (searchParams.get("person") || "").trim(), [searchParams]);
  const queryDate = useMemo(() => (searchParams.get("date") || "").trim(), [searchParams]);
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    setDate(queryDate);
    void loadPhotos({
      person: queryPerson || undefined,
      dateFrom: queryDate || undefined,
      dateTo: queryDate || undefined,
    });
  }, [loadPhotos, queryDate, queryPerson]);

  const onApplyFilters = () => {
    const next = new URLSearchParams();
    const personValue = person.trim();
    const dateValue = date.trim();

    if (personValue) {
      next.set("person", personValue);
    }
    if (dateValue) {
      next.set("date", dateValue);
    }

    setSearchParams(next);
  };

  const onClearFilters = () => {
    setPerson("");
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
                  className="group relative overflow-hidden rounded-xl"
                >
                  <img
                    src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                    alt={`Gallery photo ${i + 1}`}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
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
    </div>
  );
};

export default Gallery;

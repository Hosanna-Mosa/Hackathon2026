import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Calendar, Tag, SlidersHorizontal, Upload, MessageCircle } from "lucide-react";
import { getPhotosApi, type Photo } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const filters = [
  { icon: Users, label: "Person" },
  { icon: Calendar, label: "Date" },
  { icon: Tag, label: "Tags" },
];

const Gallery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPerson = useMemo(() => (searchParams.get("person") || "").trim(), [searchParams]);
  const [person, setPerson] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPhotos = useCallback(async (personFilter?: string) => {
    try {
      setLoading(true);
      setError("");
      const data = await getPhotosApi(personFilter);
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPerson(queryPerson);
    void loadPhotos(queryPerson || undefined);
  }, [loadPhotos, queryPerson]);

  const onApplyPersonFilter = () => {
    const nextValue = person.trim();
    if (nextValue) {
      setSearchParams({ person: nextValue });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {filters.map((f) => (
            <button
              key={f.label}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              type="button"
            >
              <f.icon className="h-4 w-4 text-muted-foreground" />
              {f.label}
            </button>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Filter by person"
              className="w-40 bg-transparent px-2 py-1 text-sm text-foreground outline-none"
            />
            <button
              type="button"
              onClick={onApplyPersonFilter}
              className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
            >
              Apply
            </button>
          </div>
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

      <div className="columns-1 gap-3 space-y-3 sm:columns-2 lg:columns-3">
        {photos.map((photo, i) => (
          <div
            key={photo._id || `${photo.imageUrl || photo.filename || "photo"}-${i}`}
            className="group relative overflow-hidden rounded-xl break-inside-avoid"
          >
            <img
              src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
              alt={`Gallery photo ${i + 1}`}
              className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
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

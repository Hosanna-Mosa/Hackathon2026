import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal, Merge, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createPersonApi, getPeopleApi, type PersonSummary } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const People = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhoto, setNewPersonPhoto] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const loadPeople = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const data = await getPeopleApi();
      setPeople(data.people || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load recognized people.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const onOpenPersonGallery = (personName: string) => {
    const params = new URLSearchParams();
    params.set("person", personName);
    navigate(`/gallery?${params.toString()}`);
  };

  const onCreatePerson = async () => {
    const name = newPersonName.trim();
    if (!name) {
      setActionError("Please enter a person name.");
      return;
    }
    if (!newPersonPhoto) {
      setActionError("Please add one clear photo for this person.");
      return;
    }
    if (!newPersonPhoto.type.startsWith("image/")) {
      setActionError("Selected file must be an image.");
      return;
    }
    if (newPersonPhoto.size > 10 * 1024 * 1024) {
      setActionError("Photo exceeds the 10MB size limit.");
      return;
    }

    try {
      setIsCreating(true);
      setActionError("");
      await createPersonApi(name, newPersonPhoto);
      setNewPersonName("");
      setNewPersonPhoto(null);
      await loadPeople();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create person label.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <span>/</span>
        <span>Library</span>
        <span>/</span>
        <span className="font-medium text-primary">People</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recognized People</h1>
          <p className="mt-1 text-muted-foreground">
            Drishyamitra AI has identified {people.length} unique labeled individuals across your library.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Sort by Count
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            <Merge className="h-4 w-4" />
            Merge Duplicates
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-5">
        {loading && (
          <div className="col-span-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading people...
          </div>
        )}

        {!loading && loadError && (
          <div className="col-span-6 rounded-xl border border-destructive/50 bg-card p-6 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {!loading &&
          !loadError &&
          people.map((person, i) => (
            <div
              key={person.personId}
              className="group flex cursor-pointer flex-col items-center rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              onClick={() => onOpenPersonGallery(person.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenPersonGallery(person.name);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="relative">
                {person.sampleImageUrl ? (
                  <img
                    src={resolvePhotoUrl(person.sampleImageUrl)}
                    alt={person.name}
                    className="h-24 w-24 rounded-full object-cover ring-2 ring-border transition-all group-hover:ring-primary"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-primary ring-2 ring-border transition-all group-hover:ring-primary">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {i === 0 && (
                  <Badge className="absolute -right-2 -top-1 bg-success text-success-foreground text-[10px]">
                    TOP
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground truncate w-full text-center">
                {person.name}
              </p>
              <p className="text-xs text-primary">{person.photos.toLocaleString()} Photos</p>
            </div>
          ))}

        {!loading && !loadError && people.length === 0 && (
          <div className="col-span-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No labeled people yet. Label faces in Upload Center and they will appear here.
          </div>
        )}

        {/* Add person */}
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-secondary/30 p-4 transition-colors hover:border-primary">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-3 text-sm font-semibold text-primary">Tag Someone</p>
          <p className="text-[10px] uppercase text-muted-foreground">One clear face only</p>
          <input
            className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            placeholder="Enter person label"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isCreating) {
                void onCreatePerson();
              }
            }}
          />
          <input
            type="file"
            accept="image/*"
            className="mt-2 w-full text-xs"
            onChange={(e) => setNewPersonPhoto(e.target.files?.[0] || null)}
          />
          {newPersonPhoto && (
            <p className="mt-1 w-full truncate text-[10px] text-muted-foreground">{newPersonPhoto.name}</p>
          )}
          <button
            type="button"
            className="mt-2 w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            onClick={onCreatePerson}
            disabled={isCreating}
          >
            {isCreating ? "Saving..." : "Save Label"}
          </button>
          {actionError && <p className="mt-2 text-center text-[10px] text-destructive">{actionError}</p>}
        </div>
      </div>

      {/* AI Smart Cleaning banner */}
      <div className="mt-8 flex items-center justify-between rounded-xl bg-primary px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-foreground/20">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-primary-foreground">AI Smart Cleaning</h3>
            <p className="text-sm text-primary-foreground/80">
              Our AI detected 14 blurry or near-duplicate photos of <em>John Doe</em>. Would you like to review and clean them up?
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/20">
            Review Now
          </button>
          <button className="rounded-lg border border-primary-foreground/30 px-5 py-2 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default People;

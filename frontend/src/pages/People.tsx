import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Merge, Plus, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createPersonApi, getPeopleApi, type PersonSummary } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const People = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonPhoto, setNewPersonPhoto] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [sortByCount, setSortByCount] = useState(true);

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
      await createPersonApi(name, newPersonPhoto, newPersonEmail.trim());
      setNewPersonName("");
      setNewPersonEmail("");
      setNewPersonPhoto(null);
      await loadPeople();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create person label.");
    } finally {
      setIsCreating(false);
    }
  };

  const sortedPeople = useMemo(() => {
    const list = [...people];
    if (sortByCount) {
      return list.sort((a, b) => b.photos - a.photos || a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [people, sortByCount]);

  return (
    <div className="animate-fade-in space-y-6">
      <header className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Users className="h-3.5 w-3.5" />
              Identity Directory
            </div>
            <h1 className="text-2xl font-bold text-foreground">Recognized People</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your labeled people and quickly open all photos for each person.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:text-sm">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-muted-foreground">Total People</p>
              <p className="mt-0.5 text-lg font-semibold text-foreground">{people.length}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-muted-foreground">Tagged Photos</p>
              <p className="mt-0.5 text-lg font-semibold text-foreground">
                {people.reduce((sum, person) => sum + Number(person.photos || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <p className="text-base font-semibold text-foreground">People Directory</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setSortByCount((prev) => !prev)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {sortByCount ? "Sort: Most Photos" : "Sort: Name"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground/60"
                disabled
                title="Will be implemented later"
              >
                <Merge className="h-3.5 w-3.5" />
                Merge Duplicates
              </button>
            </div>
          </div>

          {loading && (
            <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
              Loading people...
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {!loading && !loadError && sortedPeople.length === 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
              No labeled people yet. Label faces in Upload Center and they will appear here.
            </div>
          )}

          {!loading && !loadError && sortedPeople.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPeople.map((person, i) => (
                <button
                  key={person.personId}
                  type="button"
                  className="group rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary/50 hover:shadow-md"
                  onClick={() => onOpenPersonGallery(person.name)}
                >
                  <div className="flex items-center gap-3">
                    {person.sampleImageUrl ? (
                      <img
                        src={resolvePhotoUrl(person.sampleImageUrl)}
                        alt={person.name}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-border transition-all group-hover:ring-primary"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-lg font-bold text-primary ring-2 ring-border transition-all group-hover:ring-primary">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        {i === 0 && (
                          <Badge className="bg-success text-success-foreground text-[10px]">TOP</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{person.photos.toLocaleString()} photos</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Add New Person</p>
                <p className="text-xs text-muted-foreground">Use one clear face photo</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Person Name</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Enter person label"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating) {
                      void onCreatePerson();
                    }
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email (Optional)</label>
                <input
                  type="email"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Enter email address"
                  value={newPersonEmail}
                  onChange={(e) => setNewPersonEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Reference Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
                  onChange={(e) => setNewPersonPhoto(e.target.files?.[0] || null)}
                />
                {newPersonPhoto && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{newPersonPhoto.name}</p>
                )}
              </div>

              <button
                type="button"
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                onClick={onCreatePerson}
                disabled={isCreating}
              >
                {isCreating ? "Saving..." : "Save Label"}
              </button>
              {actionError && <p className="text-xs text-destructive">{actionError}</p>}
            </div>
          </section>

          <section className="rounded-2xl bg-primary px-4 py-4 text-primary-foreground sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">AI Smart Cleaning</h3>
                <p className="mt-1 text-xs text-primary-foreground/85">
                  Duplicate and blur cleanup recommendations will appear here.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default People;

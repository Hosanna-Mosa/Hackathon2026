import { SlidersHorizontal, Merge, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import person1 from "@/assets/person-1.jpg";
import person2 from "@/assets/person-2.jpg";
import person3 from "@/assets/person-3.jpg";

const people = [
  { name: "John Doe", photos: 1248, img: person1, verified: true },
  { name: "Sarah Smith", photos: 842, img: person2 },
  { name: "Michael Chen", photos: 531, img: person3 },
  { name: "Emily Blunt", photos: 315, img: person2 },
  { name: "David Wilson", photos: 421, img: person1 },
  { name: "Robert Fox", photos: 298, img: person3 },
  { name: "Jenny Wilson", photos: 194, img: person2 },
  { name: "Marcus Miller", photos: 178, img: person1 },
  { name: "Alicia Keys", photos: 156, img: person2 },
  { name: "Leo Grant", photos: 124, img: person3 },
];

const People = () => {
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
            Drishyamitra AI has identified 142 unique individuals across your library.
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
        {people.map((person, i) => (
          <div
            key={i}
            className="group flex flex-col items-center rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <div className="relative">
              <img
                src={person.img}
                alt={person.name}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-border transition-all group-hover:ring-primary"
              />
              {person.verified && (
                <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground">
                  ✓
                </span>
              )}
              {i === 3 && (
                <Badge className="absolute -right-2 -top-1 bg-destructive text-destructive-foreground text-[10px]">
                  NEW
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground truncate w-full text-center">
              {person.name}
            </p>
            <p className="text-xs text-primary">{person.photos.toLocaleString()} Photos</p>
          </div>
        ))}

        {/* Add person */}
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-secondary/30 p-4 transition-colors hover:border-primary">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-3 text-sm font-semibold text-primary">Tag Someone</p>
          <p className="text-[10px] uppercase text-muted-foreground">Manual Recognition</p>
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

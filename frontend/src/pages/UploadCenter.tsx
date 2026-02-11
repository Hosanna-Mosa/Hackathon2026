import { Upload, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import person1 from "@/assets/person-1.jpg";
import person2 from "@/assets/person-2.jpg";
import person3 from "@/assets/person-3.jpg";
import photo2 from "@/assets/photo-2.jpg";
import photo5 from "@/assets/photo-5.jpg";

const previews = [
  { img: photo2, status: "DETECTING FACE", color: "bg-destructive/60" },
  { img: person2, status: "INDEXING SCENE", color: "bg-warning/60" },
  { img: person1, status: "Person: Sarah J.", done: true },
  { img: photo5, status: "WAITING...", color: "bg-primary/60" },
  { img: person3, status: "Person: Mike D.", done: true },
];

const UploadCenter = () => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Center</h1>
          <p className="text-sm text-muted-foreground">Add new memories for AI indexing</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Sparkles className="h-4 w-4" />
          AI Stats
        </button>
      </div>

      {/* Drop zone */}
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-secondary/20 p-12 text-center transition-colors hover:border-primary">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Drag and drop your photos here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our AI will automatically recognize faces, categorize scenery, and index your images for easy searching.
        </p>
        <button className="mt-5 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          Select Photos from Computer
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Supported formats: JPG, PNG, HEIC (Max 50MB per file)
        </p>
      </div>

      {/* Upload progress */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Uploading Batch #402</p>
              <p className="text-xs text-muted-foreground">12 of 45 photos processed</p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">28%</span>
        </div>
        <Progress value={28} className="mt-3 h-2" />
      </div>

      {/* Upload previews */}
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Upload Previews</h2>
          <Badge variant="secondary" className="text-xs text-primary">
            ⟳ AI Recognition in Progress
          </Badge>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {previews.map((p, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl">
              <img
                src={p.img}
                alt={`Preview ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              <div className={`absolute inset-0 ${p.done ? "" : p.color || "bg-primary/40"} flex items-end justify-center pb-3`}>
                <span className="rounded-full bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground">
                  {p.done && "✓ "}{p.status}
                </span>
              </div>
              {p.done && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadCenter;

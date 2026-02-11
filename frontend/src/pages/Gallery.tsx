import { Users, Calendar, Tag, SlidersHorizontal, Upload, MessageCircle } from "lucide-react";
import photo1 from "@/assets/photo-1.jpg";
import photo2 from "@/assets/photo-2.jpg";
import photo3 from "@/assets/photo-3.jpg";
import photo4 from "@/assets/photo-4.jpg";
import photo5 from "@/assets/photo-5.jpg";
import photo6 from "@/assets/photo-6.jpg";

const photos = [photo1, photo2, photo3, photo4, photo5, photo6, photo1, photo3, photo5];

const filters = [
  { icon: Users, label: "Person" },
  { icon: Calendar, label: "Date" },
  { icon: Tag, label: "Tags" },
];

const Gallery = () => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {filters.map((f) => (
            <button
              key={f.label}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <f.icon className="h-4 w-4 text-muted-foreground" />
              {f.label}
            </button>
          ))}
          <button className="flex items-center gap-2 text-sm font-medium text-primary">
            <SlidersHorizontal className="h-4 w-4" />
            Latest First
          </button>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>

      <div className="columns-3 gap-3 space-y-3">
        {photos.map((src, i) => (
          <div key={i} className="group relative overflow-hidden rounded-xl break-inside-avoid">
            <img
              src={src}
              alt={`Gallery photo ${i + 1}`}
              className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>

      {/* Chat FAB */}
      <button className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
      </button>
    </div>
  );
};

export default Gallery;

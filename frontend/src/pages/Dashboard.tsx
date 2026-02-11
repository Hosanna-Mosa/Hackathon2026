import { Image, Users, Package, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import StatsCard from "@/components/dashboard/StatsCard";
import photo1 from "@/assets/photo-1.jpg";
import photo2 from "@/assets/photo-2.jpg";
import photo3 from "@/assets/photo-3.jpg";
import photo4 from "@/assets/photo-4.jpg";
import photo5 from "@/assets/photo-5.jpg";

const recentPhotos = [
  { src: photo1, label: "Detected" },
  { src: photo2, label: "Detected" },
  { src: photo3, label: "Detected" },
  { src: photo4, label: "Detected" },
  { src: photo5, label: "Detected" },
];

const Dashboard = () => {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome, AI Memory Assistant</h1>
          <p className="mt-1 text-muted-foreground">
            Your platform is optimized.{" "}
            <span className="font-semibold text-primary">2,410 new faces</span> indexed this week.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            <Sparkles className="h-4 w-4 text-primary" />
            Ask AI Assistant
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            <Image className="h-4 w-4" />
            Upload Photos
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          icon={Image}
          iconBg="bg-info/10 text-info"
          label="Total Photos"
          value="12,450"
          badge="↗ 12%"
          badgeColor="text-success"
        />
        <StatsCard
          icon={Users}
          iconBg="bg-warning/10 text-warning"
          label="Recognized People"
          value="84"
          badge="↗ 8%"
          badgeColor="text-success"
        />
        <StatsCard
          icon={Package}
          iconBg="bg-destructive/10 text-destructive"
          label="Recent Deliveries"
          value="12"
          badge="Stable"
          badgeColor="text-muted-foreground"
        />
        <StatsCard
          icon={Sparkles}
          iconBg="bg-success/10 text-success"
          label="AI Actions Today"
          value="156"
          badge="⚡ Active"
          badgeColor="text-success"
        />
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-5 gap-6">
        {/* Recent Uploads */}
        <div className="col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">Recent Uploads</h2>
              <Badge variant="secondary" className="text-xs font-semibold text-primary">
                LIVE FEED
              </Badge>
            </div>
            <button className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {recentPhotos.slice(0, 5).map((photo, i) => (
              <div key={i} className="group relative overflow-hidden rounded-xl">
                <img
                  src={photo.src}
                  alt={`Upload ${i + 1}`}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute left-2 top-2 bg-success text-success-foreground text-[10px]">
                  ✓ {photo.label}
                </Badge>
              </div>
            ))}
            <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <div className="text-center">
                <span className="text-2xl">+</span>
                <p className="mt-1 text-xs font-medium">Add More</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Memory Status */}
        <div className="col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground">AI Memory Status</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Assistant Online</p>
              <p className="text-xs text-success">● Listening for commands...</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">FACE INDEXING</span>
                <span className="font-semibold text-primary">94% Complete</span>
              </div>
              <Progress value={94} className="mt-1.5 h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">TAGGING ACCURACY</span>
                <span className="font-semibold text-success">High Confidence</span>
              </div>
              <Progress value={88} className="mt-1.5 h-1.5" />
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-bold text-foreground">RECENT ACTIVITY</h3>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                Identified <strong className="text-foreground">"Sarah Miller"</strong> in 24 new photos from Lake Trip.
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                Generated smart album <strong className="text-foreground">"Summer BBQ 2023"</strong> based on faces detected.
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                Uploaded 240 photos to cloud backup.
              </li>
            </ul>
          </div>

          <button className="mt-5 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            VIEW FULL LOGS
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

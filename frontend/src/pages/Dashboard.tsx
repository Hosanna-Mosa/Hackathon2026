import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Users, Package, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StatsCard from "@/components/dashboard/StatsCard";
import {
  getChatHistoryApi,
  getDeliveriesApi,
  getPeopleApi,
  getPhotosApi,
  type ChatHistoryEntry,
  type PersonSummary,
  type Photo,
} from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";

const isToday = (value?: string) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [aiActionsToday, setAiActionsToday] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setLoadError("");
        const [photosData, peopleData, deliveriesData, chatHistoryData] = await Promise.all([
          getPhotosApi(),
          getPeopleApi(),
          getDeliveriesApi({ limit: 1 }),
          getChatHistoryApi(200),
        ]);

        setPhotos(Array.isArray(photosData?.photos) ? photosData.photos : []);
        setPeople(Array.isArray(peopleData?.people) ? peopleData.people : []);
        setTotalDeliveries(Number(deliveriesData?.stats?.total || 0));
        const todayActions = Array.isArray(chatHistoryData?.history)
          ? chatHistoryData.history.filter((entry) => isToday(entry.createdAt)).length
          : 0;
        setAiActionsToday(todayActions);
        setChatHistory(Array.isArray(chatHistoryData?.history) ? chatHistoryData.history : []);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const totalPhotos = photos.length;
  const recognizedPeople = people.length;
  const recentUploads = useMemo(() => photos.slice(0, 6), [photos]);
  const recentAiActivities = useMemo(() => {
    const entries: string[] = [];
    if (chatHistory.length > 0) {
      const latestPrompt = String(chatHistory[0]?.prompt || "").trim();
      if (latestPrompt) {
        entries.push(`Latest command: "${latestPrompt}"`);
      }
    }
    entries.push(`${aiActionsToday} AI actions processed today.`);
    entries.push(`${recognizedPeople} people recognized in memory.`);
    entries.push(`${totalDeliveries} delivery actions logged.`);
    return entries.slice(0, 3);
  }, [aiActionsToday, chatHistory, recognizedPeople, totalDeliveries]);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome, AI Memory Assistant</h1>
      
        </div>
        <div className="flex gap-3">
          <button
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            type="button"
            onClick={() => navigate("/assistant")}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Ask AI Assistant
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            type="button"
            onClick={() => navigate("/upload")}
          >
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
          value={isLoading ? "..." : totalPhotos.toLocaleString()}
          badge={isLoading ? "Loading" : "Live"}
          badgeColor="text-muted-foreground"
          onClick={() => navigate("/gallery")}
        />
        <StatsCard
          icon={Users}
          iconBg="bg-warning/10 text-warning"
          label="Recognized People"
          value={isLoading ? "..." : recognizedPeople.toLocaleString()}
          badge={isLoading ? "Loading" : "Live"}
          badgeColor="text-muted-foreground"
          onClick={() => navigate("/people")}
        />
        <StatsCard
          icon={Package}
          iconBg="bg-destructive/10 text-destructive"
          label="Total Deliveries"
          value={isLoading ? "..." : totalDeliveries.toLocaleString()}
          badge={isLoading ? "Loading" : "Live"}
          badgeColor="text-muted-foreground"
          onClick={() => navigate("/deliveries")}
        />
        <StatsCard
          icon={Sparkles}
          iconBg="bg-success/10 text-success"
          label="AI Actions Today"
          value={isLoading ? "..." : aiActionsToday.toLocaleString()}
          badge={isLoading ? "Loading" : "Live"}
          badgeColor="text-muted-foreground"
          onClick={() => navigate("/assistant")}
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
                LIVE
              </Badge>
            </div>
            <button
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              type="button"
              onClick={() => navigate("/gallery")}
            >
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {loadError && <p className="mb-3 text-sm text-destructive">{loadError}</p>}
          <div className="grid grid-cols-3 gap-3">
            {recentUploads.slice(0, 5).map((photo, i) => (
              <button
                key={photo._id || `${photo.imageUrl || photo.filename || "photo"}-${i}`}
                type="button"
                onClick={() => navigate("/gallery")}
                className="group relative overflow-hidden rounded-xl"
              >
                <img
                  src={resolvePhotoUrl(photo.imageUrl || photo.path, photo.filename)}
                  alt={`Upload ${i + 1}`}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute left-2 top-2 bg-success text-success-foreground text-[10px]">
                  ✓ Detected
                </Badge>
              </button>
            ))}
            {recentUploads.length === 0 && !isLoading && (
              <div className="col-span-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                No uploads yet. Start by uploading photos.
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate("/upload")}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <div className="text-center">
                <span className="text-2xl">+</span>
                <p className="mt-1 text-xs font-medium">Add More</p>
              </div>
            </button>
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

          <div className="mt-5">
            <h3 className="text-xs font-bold text-foreground">RECENT ACTIVITY</h3>
            <ul className="mt-3 space-y-3">
              {recentAiActivities.map((activity, index) => (
                <li key={`${activity}-${index}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{activity}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => navigate("/assistant")}
            className="mt-5 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            VIEW FULL LOGS
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

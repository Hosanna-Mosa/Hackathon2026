import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock, Loader2, MessageCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  createDeliveryApi,
  getDeliveriesApi,
  sendDeliveryEmailApi,
  updateDeliveryStatusApi,
  type DeliveryRecord,
  type DeliveryStats,
} from "@/lib/api";

type StatusFilter = "sent" | "pending" | "failed";
type PlatformFilter = "email" | "whatsapp" | "direct_link";

const initialStats: DeliveryStats = {
  total: 0,
  byStatus: { pending: 0, sent: 0, failed: 0 },
  byType: { email: 0, whatsapp: 0, direct_link: 0 },
};

const statusBadgeClass: Record<StatusFilter, string> = {
  sent: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  failed: "bg-destructive text-destructive-foreground",
};

const formatDateGroupLabel = (value?: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "UNKNOWN DATE";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const input = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((today - input) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
};

const formatTime = (value?: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const platformLabel = (type: PlatformFilter) => {
  if (type === "direct_link") return "Direct Link";
  return type === "whatsapp" ? "WhatsApp" : "Email";
};

const statusLabel = (status: StatusFilter) => {
  if (status === "sent") return "Sent";
  if (status === "pending") return "Pending";
  return "Failed";
};

const Deliveries = () => {
  const [person, setPerson] = useState("David");
  const [platform, setPlatform] = useState<PlatformFilter>("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("Your photo memories are ready");
  const [message, setMessage] = useState("Hi David, sharing the selected photos with you.");
  const [photoLinks, setPhotoLinks] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [stats, setStats] = useState<DeliveryStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedStatuses] = useState<Record<StatusFilter, boolean>>({
    sent: true,
    pending: true,
    failed: true,
  });
  const [selectedPlatforms] = useState<Record<PlatformFilter, boolean>>({
    email: true,
    whatsapp: true,
    direct_link: true,
  });

  const activeStatuses = useMemo(
    () => (Object.entries(selectedStatuses).filter(([, enabled]) => enabled).map(([status]) => status) as StatusFilter[]),
    [selectedStatuses]
  );
  const activePlatforms = useMemo(
    () => (Object.entries(selectedPlatforms).filter(([, enabled]) => enabled).map(([platformType]) => platformType) as PlatformFilter[]),
    [selectedPlatforms]
  );

  const loadDeliveries = useCallback(async () => {
    if (activeStatuses.length === 0 || activePlatforms.length === 0) {
      setDeliveries([]);
      setStats(initialStats);
      setLoading(false);
      setLoadError("");
      return;
    }

    try {
      setLoading(true);
      setLoadError("");
      const response = await getDeliveriesApi({
        statuses: activeStatuses,
        types: activePlatforms,
        limit: 100,
      });
      setDeliveries(response.deliveries || []);
      setStats(response.stats || initialStats);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  }, [activePlatforms, activeStatuses]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const groupedDeliveries = useMemo(() => {
    const map = new Map<string, DeliveryRecord[]>();
    for (const item of deliveries) {
      const key = formatDateGroupLabel(item.timestamp || item.createdAt);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [deliveries]);

  const onApprove = async () => {
    if (!person.trim() || !message.trim()) {
      setActionError("Person and message are required.");
      setActionMessage("");
      return;
    }
    if (platform === "email" && !recipientEmail.trim()) {
      setActionError("Recipient email is required for email delivery.");
      setActionMessage("");
      return;
    }

    try {
      setIsSending(true);
      setActionError("");
      setActionMessage("");

      const parsedLinks = photoLinks
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);

      if (platform === "email") {
        const response = await sendDeliveryEmailApi({
          person: person.trim(),
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim(),
          message: message.trim(),
          photoLinks: parsedLinks,
        });
        setActionMessage(response.message || "Delivery email sent.");
      } else {
        const response = await createDeliveryApi({
          person: person.trim(),
          type: platform,
          status: "pending",
          message: message.trim(),
          subject: subject.trim(),
          photoLinks: parsedLinks,
        });
        setActionMessage(response.message || "Delivery entry saved as pending.");
      }

      await loadDeliveries();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to process delivery.");
    } finally {
      setIsSending(false);
    }
  };

  const onCancel = () => {
    setRecipientEmail("");
    setPhotoLinks("");
    setActionError("");
    setActionMessage("");
  };

  const onUpdateStatus = async (deliveryId: string, status: StatusFilter) => {
    try {
      setUpdatingDeliveryId(deliveryId);
      await updateDeliveryStatusApi(deliveryId, { status });
      await loadDeliveries();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update delivery status.");
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  return (
    <div className="animate-fade-in">

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery History</h1>
          <p className="text-sm text-muted-foreground">Track and manage your AI-automated photo sharing actions.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sent</p>
              <p className="text-xl font-bold text-foreground">{stats.byStatus.sent}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">{stats.byStatus.pending}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Failed</p>
              <p className="text-xl font-bold text-foreground">{stats.byStatus.failed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-6 rounded-xl border-2 border-warning/40 bg-card p-4">
            <Badge className="mb-2 bg-warning text-[10px] text-warning-foreground">Manual Delivery</Badge>
            <p className="font-semibold text-foreground">Create or send delivery</p>
            <p className="mt-1 text-xs text-muted-foreground">Email sends immediately. Other platforms are saved as pending.</p>

            <div className="mt-3 space-y-2">
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="Person"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="direct_link">Direct Link</option>
              </select>
              {platform === "email" && (
                <input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Recipient email"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              )}
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message"
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
              <textarea
                value={photoLinks}
                onChange={(e) => setPhotoLinks(e.target.value)}
                placeholder="Optional photo links (one URL per line)"
                rows={2}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </div>

            {actionError && <p className="mt-2 text-xs text-destructive">{actionError}</p>}
            {actionMessage && <p className="mt-2 text-xs text-success">{actionMessage}</p>}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onApprove()}
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {platform === "email" ? "Send Now" : "Save Pending"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSending}
                className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-border" />

            {loading && (
              <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Loading delivery history...
              </div>
            )}

            {!loading && loadError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
                {loadError}
              </div>
            )}

            {!loading && !loadError && groupedDeliveries.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                No deliveries found for current filters.
              </div>
            )}

            {!loading && !loadError && groupedDeliveries.map(([label, items], groupIndex) => (
              <div key={`${label}-${groupIndex}`}>
                <div className="relative mb-8 flex justify-center">
                  <Badge variant="secondary" className="z-10 bg-card text-xs">{label}</Badge>
                </div>

                {items.map((item, index) => {
                  const status = (item.status || "pending") as StatusFilter;
                  const isRight = index % 2 === 0;
                  return (
                    <div
                      key={item._id}
                      className={`relative mb-10 flex ${isRight ? "justify-end pl-[55%]" : "justify-start pr-[55%]"}`}
                    >
                      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4">
                        <Badge className={`mb-2 text-[10px] ${statusBadgeClass[status]}`}>{statusLabel(status)}</Badge>
                        <p className="font-semibold text-foreground">{item.person}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Platform: {platformLabel(item.type as PlatformFilter)}
                          {item.recipientEmail ? ` • ${item.recipientEmail}` : ""}
                        </p>
                        {item.message && <p className="mt-2 text-xs text-foreground">{item.message}</p>}
                        {item.errorMessage && (
                          <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{item.errorMessage}</p>
                        )}
                        {status === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={updatingDeliveryId === item._id}
                              onClick={() => void onUpdateStatus(item._id, "sent")}
                              className="rounded bg-success px-2.5 py-1 text-xs font-medium text-success-foreground disabled:opacity-60"
                            >
                              Mark Sent
                            </button>
                            <button
                              type="button"
                              disabled={updatingDeliveryId === item._id}
                              onClick={() => void onUpdateStatus(item._id, "failed")}
                              className="rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-60"
                            >
                              Mark Failed
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={`absolute ${isRight ? "-left-3 text-right" : "-right-3"} top-4 text-xs text-muted-foreground`}>
                        <p className="font-medium text-foreground">{formatTime(item.timestamp || item.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
      </button>
    </div>
  );
};

export default Deliveries;

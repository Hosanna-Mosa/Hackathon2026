import { CheckCircle, Clock, Filter, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import person1 from "@/assets/person-1.jpg";
import person2 from "@/assets/person-2.jpg";

const Deliveries = () => {
  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-1 text-sm text-muted-foreground">
        <span>DASHBOARD</span> / <span className="font-medium text-primary">DELIVERY HISTORY</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery History</h1>
          <p className="text-sm text-muted-foreground">Track and manage your AI-automated photo sharing actions.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sent Photos</p>
              <p className="text-xl font-bold text-foreground">1,240</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">12</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters */}
        <div className="w-56 space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">Filters</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-primary mb-2">Status</p>
              <div className="space-y-2">
                {["Delivered", "Pending", "Failed"].map((s, i) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox defaultChecked={i < 2} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-primary mb-2">Platform</p>
              <div className="space-y-2">
                {["WhatsApp", "Email", "Direct Link"].map((p, i) => (
                  <label key={p} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox defaultChecked={i < 2} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">Need Help?</p>
            <p className="mt-1 text-xs text-muted-foreground">Our AI assistant can help automate your delivery preferences.</p>
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
              Ask Chatbot
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-border" />

            {/* Today */}
            <div className="relative mb-8 flex justify-center">
              <Badge variant="secondary" className="z-10 bg-card text-xs">TODAY, OCT 24</Badge>
            </div>

            {/* Timeline items */}
            <div className="relative mb-10 flex justify-end pl-[55%]">
              <div className="rounded-xl border border-border bg-card p-4 w-full max-w-sm">
                <Badge className="bg-success text-success-foreground text-[10px] mb-2">Sent</Badge>
                <p className="font-semibold text-foreground">Sent 52 photos to Mom</p>
                <p className="text-xs text-muted-foreground mt-1">Faces recognized: Alex, Mom, Sarah.</p>
                <div className="mt-2 flex items-center gap-1">
                  {[person1, person2].map((p, i) => (
                    <img key={i} src={p} alt="Face" className="h-7 w-7 rounded-full object-cover ring-1 ring-card" />
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">+2</span>
                </div>
              </div>
              <div className="absolute -left-3 top-4 text-right text-xs text-muted-foreground">
                <p className="font-medium text-foreground">10:45 AM</p>
                <p>From "Summer Vacation" Album</p>
              </div>
            </div>

            <div className="relative mb-10 flex justify-start pr-[55%]">
              <div className="rounded-xl border-2 border-warning/40 bg-card p-4 w-full max-w-sm">
                <Badge className="bg-warning text-warning-foreground text-[10px] mb-2">Pending</Badge>
                <p className="font-semibold text-foreground">Queued: 12 photos for David</p>
                <p className="text-xs text-muted-foreground mt-1">Waiting for approval to email.</p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">Approve</button>
                  <button className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-foreground">Cancel</button>
                </div>
              </div>
              <div className="absolute -right-3 top-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">09:15 AM</p>
                <p>Automated by Face Matching</p>
              </div>
            </div>

            {/* Yesterday */}
            <div className="relative mb-8 flex justify-center">
              <Badge variant="secondary" className="z-10 bg-card text-xs">YESTERDAY, OCT 23</Badge>
            </div>

            <div className="relative mb-10 flex justify-end pl-[55%]">
              <div className="rounded-xl border border-border bg-card p-4 w-full max-w-sm">
                <Badge className="bg-success text-success-foreground text-[10px] mb-2">Sent</Badge>
                <p className="font-semibold text-foreground">Shared private link to "Wedding Party"</p>
                <p className="text-xs text-muted-foreground mt-1">Sent to 15 recipients via SMS.</p>
                <div className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono">
                  drishya.me/sh/wddng-24...
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Load Older History ↓
            </button>
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <button className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
      </button>
    </div>
  );
};

export default Deliveries;

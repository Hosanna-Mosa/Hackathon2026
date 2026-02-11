import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  iconBg: string;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}

const StatsCard = ({ icon: Icon, iconBg, label, value, badge, badgeColor = "text-success" }: StatsCardProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className={`text-xs font-semibold ${badgeColor}`}>{badge}</span>
        )}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
};

export default StatsCard;

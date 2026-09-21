import React from "react";
import {
  CheckCircle2,
  Coffee,
  Zap,
  Clock,
  Award,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    textColor: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
  }
> = {
  in: {
    label: "حضور",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  break: {
    label: "استراحة",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: Coffee,
  },
  break_end: {
    label: "عودة",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Zap,
  },
  out: {
    label: "انصراف",
    color: "bg-red-500",
    textColor: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: Clock,
  },
};

export const aiConfig = {
  excellent: {
    label: "ممتاز",
    color: "text-success",
    bgColor: "bg-success/10",
    icon: Award,
  },
  good: {
    label: "جيد",
    color: "text-warning",
    bgColor: "bg-warning/10",
    icon: ShieldCheck,
  },
  poor: {
    label: "ضعيف",
    color: "text-danger",
    bgColor: "bg-danger/10",
    icon: AlertCircle,
  },
};

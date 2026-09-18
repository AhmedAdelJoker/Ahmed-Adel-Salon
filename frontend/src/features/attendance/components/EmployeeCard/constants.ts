import {
  UserCheck,
  Clock,
  ShieldCheck,
  AlertCircle,
  Award,
  Zap,
  Coffee,
} from "lucide-react";

export const statusConfig = {
  in: {
    label: "متواجد",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    icon: UserCheck,
  },
  break: {
    label: "استراحة",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    icon: Coffee,
  },
  break_end: {
    label: "عودة",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    icon: Zap,
  },
  out: {
    label: "انصراف",
    color: "bg-red-500",
    textColor: "text-red-500",
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

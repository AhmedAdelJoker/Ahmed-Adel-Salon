import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { POSRecord } from "@/features/pos/types";
import type { ID } from "@/types/common";
import { Zap } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

export interface BarberSelectorProps {
  selectedBarberId: string;
  setSelectedBarberId: Dispatch<SetStateAction<string>>;
  barbers: POSRecord[];
  assignBarberToAll: (barberId: ID) => void;
  cartLength: number;
}

export const BarberSelector = ({
  selectedBarberId,
  setSelectedBarberId,
  barbers,
  assignBarberToAll,
  cartLength,
}: BarberSelectorProps) => {
  return (
    <Card className="p-3 space-y-2 bg-card border-border/50 shadow-sm shrink-0">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black uppercase text-muted flex items-center gap-1">
          <Zap size={12} /> الخبير الافتراضي
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 px-3 text-[10px] font-black uppercase hover:bg-primary/10 hover:text-primary transition-all touch-target"
          onClick={() => assignBarberToAll(selectedBarberId)}
          disabled={!selectedBarberId || cartLength === 0}
        >
          تعيين للكل
        </Button>
      </div>
      <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
        <SelectTrigger
          className="h-12 rounded-xl bg-soft/50 border-none font-bold text-xs touch-target"
          aria-label="اختر خبير للخدمات الجديدة"
        >
          <SelectValue placeholder="اختر خبير للخدمات الجديدة" />
        </SelectTrigger>
        <SelectContent>
          {barbers.map((b) => (
            <SelectItem key={b.id as string} value={String(b.id)}>
              {b.display_name || b.displayName || b.full_name || b.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};

export default BarberSelector;

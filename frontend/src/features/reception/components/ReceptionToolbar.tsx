/** Reception toolbar (moved from ReceptionBoard page, no logic changes). */
import { History, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReceptionToolbar({
  searchTerm,
  onSearchChange,
  barberFilter,
  onBarberFilter,
  barbers,
  showDone,
  onToggleDone,
  doneCount,
}: {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  barberFilter: string;
  onBarberFilter: (v: string) => void;
  barbers: any[];
  showDone: boolean;
  onToggleDone: () => void;
  doneCount: number;
}) {
  return (
    <div className="surface-toolbar flex flex-col md:flex-row flex-wrap gap-2 md:items-center justify-between">
      <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-md min-w-0">
        <Search
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="بحث فوري بالاسم أو الهاتف..."
          className="h-11 pr-11 pl-4 rounded-xl"
          aria-label="بحث في المواعيد"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
            aria-label="مسح البحث"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
        <Select value={barberFilter} onValueChange={onBarberFilter}>
          <SelectTrigger className="h-11 w-full lg:w-52 bg-soft border-border rounded-xl font-bold text-xs">
            <SelectValue placeholder="كل الخبراء" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-bold">
              كل الخبراء
            </SelectItem>
            {barbers.map((b) => (
              <SelectItem
                key={b.id}
                value={String(b.id)}
                className="font-bold"
              >
                {b.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showDone ? "primary" : "outline"}
          onClick={onToggleDone}
          className="h-11 px-4 rounded-xl font-black text-xs flex-1 lg:flex-none"
        >
          <History size={15} className="ml-1" />
          مكتمل اليوم ({doneCount})
        </Button>
      </div>
    </div>
  );
}

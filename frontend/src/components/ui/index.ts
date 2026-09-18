// UI Primitives
export { Panel } from "@/components/ui/Panel";
export { Button } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export {
  Select,
  SelectItem,
  SelectGroup,
  SelectSeparator,
} from "@/components/ui/select";
export { Badge } from "@/components/ui/badge";
export { Avatar } from "@/components/ui/Avatar";
export {
  Table,
  TableHeader as Thead,
  TableBody as Tbody,
  TableRow as Tr,
  TableHead as Th,
  TableCell as Td,
} from "@/components/ui/table";
export { Sidebar } from "@/components/ui/Sidebar";
// CommandPalette: use the canonical version from @/components/layout/CommandPalette
export { EmptyState } from "@/components/ui/EmptyState";
export { ToastProvider, useToast, useToastHelpers } from "@/components/ui/Toast";

// Legacy shadcn/ui components (keep for backward compatibility)
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export { Checkbox } from "@/components/ui/checkbox";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
export {
  Select as LegacySelect,
  SelectContent,
  SelectItem as LegacySelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export { Switch } from "@/components/ui/switch";
export { Skeleton } from "@/components/ui/skeleton";
export { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
export { DatePicker } from "@/components/ui/date-picker";
export { TimePicker } from "@/components/ui/time-picker";

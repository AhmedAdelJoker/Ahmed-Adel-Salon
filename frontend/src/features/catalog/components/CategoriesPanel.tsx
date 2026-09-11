/** Catalog CategoriesPanel (moved from ServicesManagement page, no logic changes). */
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/shared/PremiumUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isItemActive } from "@/features/catalog/constants";
import type { CategoryRecord } from "@/types/catalog";

export default function CategoriesPanel({
  rows,
  onEdit,
  onDelete,
}: {
  rows: CategoryRecord[];
  onEdit: (cat: CategoryRecord) => void;
  onDelete: (id: number | string) => void;
}) {
  return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ContentPanel
            title="إدارة التصنيفات الفنية"
            subtitle="تنظيم الخدمات في مجموعات منطقية لتسهيل الوصول إليها في الـ POS والموقع العام."
            noPadding
          >
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      التصنيف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      ترتيب العرض
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      حالة الظهور
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((cat) => (
                    <TableRow
                      key={cat.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
                            {cat.name_ar?.charAt(0) || cat.name?.charAt(0)}
                          </div>
                          <div className="font-black text-main text-sm">
                            {cat.name_ar || cat.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-8 w-8 rounded-lg bg-soft flex items-center justify-center font-black text-xs text-muted">
                          {cat.sort_order || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isItemActive(cat) ? (
                          <Badge
                            variant="success"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            نشط
                          </Badge>
                        ) : (
                          <Badge
                            variant="danger"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            معطل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(cat)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onDelete(cat.id as number | string)
                            }
                            className="h-10 w-10 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ContentPanel>
        </div>
  );
}

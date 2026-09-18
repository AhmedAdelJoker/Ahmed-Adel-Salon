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
            {rows.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center opacity-60">
                <div className="h-14 w-14 rounded-2xl bg-soft border flex items-center justify-center mb-3 text-muted">
                  #
                </div>
                <p className="text-sm font-black text-main">لا توجد تصنيفات</p>
                <p className="text-xs font-bold text-muted mt-1">أضف تصنيفاً جديداً لتنظيم الخدمات</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-soft/30">
                      <TableRow className="hover:bg-transparent border-border/40 h-12">
                        <TableHead className="font-black text-muted px-5 text-right text-[10px] tracking-widest whitespace-nowrap">
                          التصنيف
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          ترتيب العرض
                        </TableHead>
                        <TableHead className="font-black text-muted text-center text-[10px] tracking-widest whitespace-nowrap">
                          حالة الظهور
                        </TableHead>
                        <TableHead className="font-black text-muted text-left px-5 text-[10px] tracking-widest whitespace-nowrap">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((cat) => (
                        <TableRow key={cat.id} className="border-border/40 hover:bg-soft/30">
                          <TableCell className="px-5 py-4 max-w-[280px]">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0">
                                {cat.name_ar?.charAt(0) || cat.name?.charAt(0) || "?"}
                              </div>
                              <span
                                className="font-black text-main text-sm truncate"
                                title={(cat.name_ar || cat.name || "") as string}
                              >
                                {cat.name_ar || cat.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-soft border px-2 text-xs font-black tabular-nums text-muted">
                              {cat.sort_order ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {isItemActive(cat) ? (
                              <Badge variant="success" className="px-3 rounded-full text-[10px] font-black">
                                نشط
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="px-3 rounded-full text-[10px] font-black">
                                معطل
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(cat)}
                                className="h-8 w-8 rounded-xl border bg-card text-muted hover:text-primary"
                                aria-label="تعديل التصنيف"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(cat.id as number | string)}
                                className="h-8 w-8 rounded-xl border bg-card text-muted hover:text-rose-600"
                                aria-label="حذف التصنيف"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 p-4 sm:hidden">
                  {rows.map((cat) => (
                    <div key={cat.id} className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black shrink-0">
                          {cat.name_ar?.charAt(0) || cat.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-main truncate" title={(cat.name_ar || cat.name || "") as string}>
                            {cat.name_ar || cat.name}
                          </div>
                          <div className="text-xs font-bold text-muted tabular-nums">ترتيب {cat.sort_order ?? 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isItemActive(cat) ? (
                          <Badge variant="success" className="text-[10px]">نشط</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">معطل</Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onEdit(cat)} className="h-9 rounded-xl px-3 text-xs font-black">
                          <Pencil size={14} className="ml-1" /> تعديل
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ContentPanel>
        </div>
  );
}

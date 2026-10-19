/** Catalog OffersPanel (moved from ServicesManagement page, no logic changes). */
import { useState } from "react";
import { Gift, Percent, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import { currencyLabel } from "@/lib/core/currency";
import { resolveAssetUrl } from "@/lib/media/assetUrl";
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
import type { OfferRecord } from "@/types/catalog";

/**
 * An offer past its `end_date`.
 *
 * `is_active` is a switch the owner flips; the date window is a fact about
 * time. `/offers/active` filters on both, but this panel fetched the unfiltered
 * list and reported only the switch — so an offer that expired last month still
 * read "نشط" here and the owner had no way to tell which rows were actually live.
 */
function isExpired(offer: OfferRecord): boolean {
  const end = offer.end_date;
  if (!end) return false;
  const parsed = new Date(`${end}T23:59:59`);
  return Number.isNaN(parsed.getTime()) ? false : parsed < new Date();
}

/**
 * The offer's own image, or the gift glyph when there is none.
 *
 * `image_url` has been on the offer since the schema was written and the upload
 * endpoint writes it, but this panel rendered a hardcoded `Gift` for every row
 * regardless — so an offer the owner had photographed still showed a generic
 * icon. `ProductBundles`, which reads the same column, always showed the image.
 */
function OfferThumbnail({ offer, size = 36 }: { offer: OfferRecord; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = resolveAssetUrl(offer.image_url);
  const showImage = Boolean(src) && !broken;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/10 text-emerald-600"
      style={{ height: size, width: size }}
    >
      {showImage ? (
        <img
          src={src as string}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <Gift size={size <= 36 ? 16 : 20} aria-hidden="true" />
      )}
    </div>
  );
}

export default function OffersPanel({
  rows,
  onEdit,
  onDelete,
}: {
  rows: OfferRecord[];
  onEdit: (offer: OfferRecord) => void;
  onDelete: (id: number | string) => void;
}) {
  return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ContentPanel
            title="باقات العروض الترويجية"
            subtitle="إدارة الحزم التسويقية والخصومات الزمنية لزيادة معدل مبيعات الخدمات."
            noPadding
          >
            {rows.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center opacity-60">
                <div className="h-14 w-14 rounded-2xl bg-soft border flex items-center justify-center mb-3 text-muted">
                  <Gift size={22} />
                </div>
                <p className="text-sm font-black text-main">لا توجد عروض</p>
                <p className="text-xs font-bold text-muted mt-1">أنشئ أول عرض ترويجي من زر الإضافة</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-soft/30">
                      <TableRow className="hover:bg-transparent border-border/40 h-12">
                        <TableHead className="font-black text-muted px-5 text-right text-[10px] tracking-widest whitespace-nowrap">
                          العرض والوصف
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          السعر الجديد
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          الخصم
                        </TableHead>
                        <TableHead className="font-black text-muted text-center text-[10px] tracking-widest whitespace-nowrap">
                          الحالة
                        </TableHead>
                        <TableHead className="font-black text-muted text-left px-5 text-[10px] tracking-widest whitespace-nowrap">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((offer) => (
                        <TableRow key={offer.id} className="border-border/40 hover:bg-soft/30">
                          <TableCell className="px-5 py-4 max-w-[280px]">
                            <div className="flex items-center gap-3 min-w-0">
                              <OfferThumbnail offer={offer} />
                              <div className="min-w-0">
                                <div
                                  className="font-black text-main text-sm leading-none truncate"
                                  title={(offer.name_ar || offer.name || "") as string}
                                >
                                  {offer.name_ar || offer.name}
                                </div>
                                <div className="text-[11px] font-bold text-muted truncate">
                                  {offer.description_ar || offer.description || "بدون وصف إضافي"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-sm font-black tabular-nums text-emerald-600">
                              {offer.offer_price}{" "}
                              <span className="text-[10px] font-bold">
                                {currencyLabel()}
                              </span>
                              {offer.original_price && (
                                <span className="text-[11px] font-bold text-muted line-through me-2">
                                  {formatCurrency(offer.original_price)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-200 px-2.5 py-1 text-[11px] font-black tabular-nums text-emerald-700">
                              <Percent size={11} />
                              {offer.discount_percentage || 0}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {isExpired(offer) ? (
                              <Badge variant="secondary" className="px-3 rounded-full text-[10px] font-black border-amber-300 bg-amber-50 text-amber-700">
                                منتهي الصلاحية
                              </Badge>
                            ) : isItemActive(offer) ? (
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
                                onClick={() => onEdit(offer)}
                                className="h-8 w-8 rounded-xl border bg-card text-muted hover:text-primary"
                                aria-label="تعديل العرض"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(offer.id as number | string)}
                                className="h-8 w-8 rounded-xl border bg-card text-muted hover:text-rose-600"
                                aria-label="حذف العرض"
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
                  {rows.map((offer) => (
                    <div key={offer.id} className="rounded-2xl border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <OfferThumbnail offer={offer} size={40} />
                          <div className="min-w-0">
                            <div className="text-sm font-black text-main leading-tight line-clamp-2">
                              {offer.name_ar || offer.name}
                            </div>
                            <div className="text-[11px] font-bold text-muted truncate">
                              {offer.description_ar || offer.description || "بدون وصف"}
                            </div>
                          </div>
                        </div>
                        {isExpired(offer) ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px] border-amber-300 bg-amber-50 text-amber-700">
                            منتهي
                          </Badge>
                        ) : isItemActive(offer) ? (
                          <Badge variant="success" className="shrink-0 text-[10px]">نشط</Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">معطل</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black tabular-nums text-emerald-600">
                          {formatCurrency(offer.offer_price)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-200 px-2 py-1 text-xs font-black text-emerald-700">
                          <Percent size={11} /> {offer.discount_percentage || 0}%
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(offer)} className="h-9 rounded-xl px-4 text-xs font-black">
                          <Pencil size={14} className="ms-1" /> تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(offer.id as number | string)}
                          className="h-9 w-9 rounded-xl border text-muted"
                          aria-label="حذف العرض"
                        >
                          <Trash2 size={14} />
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

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import {
  User,
  Scissors,
  CheckCircle,
  MessageSquare,
  DollarSign,
  Trash2,
  Plus,
  Star,
  Zap,
} from "lucide-react";

interface Product {
  id: number | string;
  name: string;
  price: number;
}

interface ServiceDetailsPanelProps {
  serviceNotes: string;
  setServiceNotes: React.Dispatch<React.SetStateAction<string>>;
  productsUsed: Product[];
  setProductsUsed: React.Dispatch<React.SetStateAction<Product[]>>;
  onAddProduct: () => void;
  totalProducts: number;
  formatCurrency: (value: unknown) => string;
}

export const ServiceDetailsPanel = ({
  serviceNotes,
  setServiceNotes,
  productsUsed,
  setProductsUsed,
  onAddProduct,
  totalProducts,
  formatCurrency,
}: ServiceDetailsPanelProps) => {
  return (
    <div className="lg:col-span-2 space-y-4">
      {/* Service Steps */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Zap size={16} className="text-primary" /> خطوات الخدمة
        </h3>
        <div className="space-y-3">
          {[
            { id: 1, label: "استقبال العميل", icon: User },
            { id: 2, label: "استشارة وتحليل", icon: MessageSquare },
            { id: 3, label: "تنفيذ الخدمة", icon: Scissors },
            { id: 4, label: "مراجعة نهائية", icon: CheckCircle },
            { id: 5, label: "تسليم وإيصال", icon: DollarSign },
          ].map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-soft/50 hover:bg-soft transition-colors"
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  i < 2
                    ? "bg-success/10 text-success"
                    : i === 2
                      ? "bg-primary/10 text-primary"
                      : "bg-soft text-muted",
                )}
              >
                <step.icon size={16} />
              </div>
              <span className="text-sm font-black text-main">
                {step.label}
              </span>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <CheckCircle size={14} className="text-success" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-info" /> ملاحظات الخدمة
        </h3>
        <Textarea
          value={serviceNotes}
          onChange={(e) => setServiceNotes(e.target.value)}
          placeholder="اكتب ملاحظاتك هنا... (الحساسية، التفضيلات، تعليمات خاصة...)"
          className="h-28 rounded-xl border border-border bg-soft focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Products Used */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-main flex items-center gap-2">
            <Star size={16} className="text-warning" /> منتجات مستخدمة
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={onAddProduct}
          >
            <Plus size={12} className="ml-1.5" /> إضافة
          </Button>
        </div>
        {productsUsed.length === 0 ? (
          <div className="text-center py-6 text-muted">
            <Star size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا توجد منتجات مضافة</p>
          </div>
        ) : (
          <div className="space-y-2">
            {productsUsed.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-xl bg-soft/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-main">
                    {p.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 text-[8px] font-black"
                  >
                    {formatCurrency(p.price)}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger"
                  onClick={() =>
                    setProductsUsed((prev) =>
                      prev.filter((x) => x.id !== p.id),
                    )
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </motion.div>
            ))}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm font-bold text-muted">
                إجمالي المنتجات
              </span>
              <span className="text-lg font-black text-warning">
                {formatCurrency(totalProducts)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

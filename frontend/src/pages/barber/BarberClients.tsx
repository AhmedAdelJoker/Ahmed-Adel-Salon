import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  User,
  Users,
  Search,
  Star,
  Plus,
  Edit2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PageHeader,
} from "@/components/shared/PremiumUI";


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const BarberClients = () => {
  const { user } = useAuth();
   
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
   
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    preferred_service: "",
    preferred_time: "",
    birthday: "",
  });

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/barber/clients");
      setClients(res.data || []);
    } catch (err) {
      console.error("Clients fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

   
  const handleEdit = (client: any) => {
    setFormData({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      notes: client.notes || "",
      preferred_service: client.preferred_service || "",
      preferred_time: client.preferred_time || "",
      birthday: client.birthday || "",
    });
    setSelectedClient(client);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (isEditing) {
        await api.put(`/barber/clients/${selectedClient?.id}`, formData);
      } else {
        await api.post("/barber/clients", formData);
      }
      setIsModalOpen(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        notes: "",
        preferred_service: "",
        preferred_time: "",
        birthday: "",
      });
      fetchClients();
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  const filteredClients = clients.filter(
     
    (c: any) =>
      (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || "").includes(searchTerm),
  );

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader
          title="عملائي"
          subtitle="إدارة العملاء وتاريخهم وتفضيلاتهم"
          badge="CRM"
          icon={Users}
          className={undefined}
          actions={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setFormData({
                  name: "",
                  phone: "",
                  email: "",
                  notes: "",
                  preferred_service: "",
                  preferred_time: "",
                  birthday: "",
                });
                setIsEditing(false);
                setSelectedClient(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={14} className="ml-1.5" /> إضافة عميل
            </Button>
          }
        />

        {/* Search */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="h-10 w-full pr-9 text-sm"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-card border border-border animate-pulse"
              />
            ))
          ) : filteredClients.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <Users size={40} className="mb-3 text-muted" />
              <p className="text-base font-black text-main">لا توجد عملاء</p>
              <p className="mt-1 text-xs font-bold text-muted">
                ابدأ بإضافة أول عميل
              </p>
            </div>
          ) : (
            filteredClients.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-border bg-card p-4 shadow-soft hover:shadow-premium transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-main truncate">
                        {client.name}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit2 size={12} />
                      </Button>
                    </div>
                    <p className="text-[10px] font-bold text-muted mt-0.5">
                      {client.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {client.preferred_service && (
                        <Badge
                          variant="outline"
                          className="h-5 text-[8px] font-black"
                        >
                          {client.preferred_service}
                        </Badge>
                      )}
                      {client.total_visits > 0 && (
                        <span className="text-[9px] font-bold text-muted flex items-center gap-1">
                          <Star size={10} /> {client.total_visits} زيارة
                        </span>
                      )}
                    </div>
                    {client.notes && (
                      <p className="text-[9px] font-bold text-muted mt-2 line-clamp-1">
                        {client.notes}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Add/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "تعديل عميل" : "إضافة عميل جديد"}
              </DialogTitle>
              <DialogDescription>معلومات العميل وتفضيلاته</DialogDescription>
            </DialogHeader>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الاسم *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  placeholder="اسم العميل"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الهاتف *
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  placeholder="010xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الإيميل
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الخدمة المفضلة
                </label>
                <Select
                  value={formData.preferred_service}
                  onValueChange={(v) =>
                    setFormData({ ...formData, preferred_service: v })
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="اختر الخدمة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="قص شعر">قص شعر</SelectItem>
                    <SelectItem value="حلاقة ذقن">حلاقة ذقن</SelectItem>
                    <SelectItem value="قص + ذقن">قص + ذقن</SelectItem>
                    <SelectItem value="صبغة">صبغة</SelectItem>
                    <SelectItem value="عناية">عناية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الموعد المفضل
                </label>
                <Input
                  type="time"
                  value={formData.preferred_time}
                  onChange={(e) =>
                    setFormData({ ...formData, preferred_time: e.target.value })
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  تاريخ الميلاد
                </label>
                <Input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) =>
                    setFormData({ ...formData, birthday: e.target.value })
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  ملاحظات
                </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="h-20 rounded-xl"
                  placeholder="حساسية، تفضيلات خاصة، إلخ..."
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormData({
                    name: "",
                    phone: "",
                    email: "",
                    notes: "",
                    preferred_service: "",
                    preferred_time: "",
                    birthday: "",
                  });
                }}
              >
                إلغاء
              </Button>
              <Button onClick={handleSubmit} className="h-10 rounded-xl">
                {isEditing ? "حفظ" : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BarberClients;

import { Edit3, Trash2, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";

export interface UsersViewUser {
  id: string | number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  is_active: boolean;
  profileImageUrl?: string | null;
  profile_image_url?: string | null;
  permissions?: Record<string, boolean>;
}

export interface UsersViewContentProps {
  loading: boolean;
  viewMode: string;
  filteredUsers: UsersViewUser[];
  onEdit: (user: UsersViewUser) => void;
  onOpenPerms: (user: UsersViewUser) => void;
  onDeleteRequest: (id: string | number) => void;
}

export function UsersViewContent({
  loading,
  viewMode,
  filteredUsers,
  onEdit,
  onOpenPerms,
  onDeleteRequest,
}: UsersViewContentProps) {
  return (
    <>
      {/* View Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-soft animate-pulse border border-border"
            />
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={user.id}
              >
                <PremiumCard
                  className="h-full flex flex-col group overflow-hidden"
                  noPadding
                  hoverable
                >
                  <div className="p-6 space-y-6 flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4 min-w-0">
                        <EmployeeAvatar
                          imageUrl={
                            user.profileImageUrl || user.profile_image_url
                          }
                          name={user.full_name || user.username}
                          role={undefined}
                          size="xl"
                          className="border-2 border-soft group-hover:border-primary/20 transition-colors shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-main leading-tight mb-1 group-hover:text-primary transition-colors truncate">
                            {user.full_name || user.username}
                          </h3>
                          <p
                            className="text-[10px] font-black text-muted uppercase tracking-widest truncate"
                            dir="ltr"
                          >
                            @{user.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(user)}
                          className="h-8 w-8 rounded-lg bg-soft text-muted hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all"
                        >
                          <Edit3 size={14} />
                        </button>
                        {user.role !== "OWNER" && (
                          <button
                            onClick={() => onDeleteRequest(user.id)}
                            className="h-8 w-8 rounded-lg bg-soft text-muted hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50 border border-border/40">
                        <span className="text-[10px] font-black text-muted uppercase tracking-tighter">
                          الرتبة الوظيفية
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-none font-black text-[10px] px-2 py-0.5 rounded-lg"
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50 border border-border/40">
                        <span className="text-[10px] font-black text-muted uppercase tracking-tighter">
                          حالة الوصول
                        </span>
                        <div className="flex items-center gap-2">
                          {user.is_active ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                              مصرح له
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{" "}
                              معلق
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-soft/30 border-t border-border/40 mt-auto">
                    <Button
                      onClick={() => onOpenPerms(user)}
                      className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white border border-border hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                    >
                      <Shield size={14} className="ml-2" /> تعديل بروتوكول
                      الصلاحيات
                    </Button>
                  </div>
                </PremiumCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <PremiumCard className="overflow-hidden" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-soft/30">
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50">
                    الموظف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    اسم المستخدم
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    الرتبة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    حالة النظام
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-soft/20 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <EmployeeAvatar
                          imageUrl={
                            user.profileImageUrl || user.profile_image_url
                          }
                          name={user.full_name || user.username}
                          role={undefined}
                          size="sm"
                          className="rounded-lg"
                        />
                        <div className="font-black text-main text-sm">
                          {user.full_name || user.username}
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-8 py-5 text-xs text-muted font-bold"
                      dir="ltr"
                    >
                      @{user.username}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Badge
                        variant="outline"
                        className="font-black text-[10px] uppercase border-border bg-white shadow-sm px-2"
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="inline-flex items-center justify-center">
                        {user.is_active ? (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-black text-[9px] border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                            نشط
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 text-rose-600 font-black text-[9px] border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{" "}
                            موقوف
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(user)}
                          className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-primary hover:border-primary transition-all flex items-center justify-center shadow-sm"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => onOpenPerms(user)}
                          className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-primary hover:border-primary transition-all flex items-center justify-center shadow-sm"
                        >
                          <Shield size={16} />
                        </button>
                        {user.role !== "OWNER" && (
                          <button
                            onClick={() => onDeleteRequest(user.id)}
                            className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-rose-600 hover:border-rose-600 transition-all flex items-center justify-center shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}
    </>
  );
}

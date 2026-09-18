import {
  useBarberDashboard,
  SalaryHighlight,
  DashboardStats,
  QueueTab,
  PerformanceTab,
  BarberSchedule,
} from "@/features/barber-dashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Scissors, BarChart3, CalendarDays, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BarberDashboard = () => {
  const {
    user,
    stats,
    projectedSalary,
    performanceData,
    activeTab,
    setActiveTab,
    fetchDashboardData,
    handleStatusChange,
    queueRows,
    waitingCount,
    completedCount,
    totalRevenue,
    totalServices,
  } = useBarberDashboard();

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-lg">
              <Scissors className="text-inverse w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-main tracking-tight">
                مرحباً، {user?.full_name || "حلاق"} 👋
              </h1>
              <p className="text-sm text-muted font-bold">لوحة التحكم الخاصة بك - تابع أداءك وإدارة عملك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="h-10 px-4 rounded-xl bg-success-soft text-success border-none font-black text-[10px] uppercase tracking-widest gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              الوردية نشطة
            </Badge>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={fetchDashboardData}>
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Projected Salary Highlight */}
        <SalaryHighlight projectedSalary={projectedSalary} />

        {/* Stats Cards */}
        <DashboardStats stats={stats} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-card border border-border p-1">
            <TabsTrigger
              value="queue"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Zap size={14} className="ml-1.5" /> قائمة الانتظار
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <BarChart3 size={14} className="ml-1.5" /> الأداء
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <CalendarDays size={14} className="ml-1.5" /> الجدول
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            <QueueTab
              queueRows={queueRows}
              waitingCount={waitingCount}
              completedCount={completedCount}
              fetchDashboardData={fetchDashboardData}
              handleStatusChange={handleStatusChange}
            />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <PerformanceTab
              performanceData={performanceData}
              totalRevenue={totalRevenue}
              totalServices={totalServices}
            />
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <BarberSchedule />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarberDashboard;

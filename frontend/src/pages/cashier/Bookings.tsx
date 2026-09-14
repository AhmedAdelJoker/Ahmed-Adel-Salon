import { Calendar } from "lucide-react";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";

import {
  SalonCapacityBanner,
  BookingsStatsGrid,
  BookingsHeaderActions,
  BookingsToolbar,
  BookingsBoardContent,
  BookingFormDialog,
  WalkInDialog,
  CancelBookingDialog,
} from "@/features/bookings/components";
import { useBookingsData } from "@/features/bookings/hooks/useBookingsData";

export default function Bookings() {
  const {
    navigate,
    location,
    socket,
    connected,
    dateFilter,
    setDateFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activeTab,
    setActiveTab,
    quickFilter,
    setQuickFilter,
    searchTerm,
    setSearchTerm,
    selectedEmployeeId,
    setSelectedEmployeeId,
    refreshing,
    lastUpdated,
    bookings,
    employees,
    services,
    categories,
    appointmentsQuery,
    salonCapacity,
    stats,
    tabCounts,
    filteredBookings,
    invalidateAppointments,
    refreshBookings,
    phoneInputRef,
    searchInputRef,
    isWalkInOpen,
    setIsWalkInOpen,
    walkInData,
    setWalkInData,
    walkInSaving,
    walkInCustomer,
    setWalkInCustomer,
    walkInSuggestions,
    setWalkInSuggestions,
    isModalOpen,
    setIsModalOpen,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    bookingToCancel,
    setBookingToCancel,
    cancellationReason,
    setCancellationReason,
    editingBooking,
    setEditingBooking,
    saving,
    setSaving,
    actionLoading,
    setActionLoading,
    duplicateBooking,
    setDuplicateBooking,
    viewMode,
    setViewMode,
    formData,
    setFormData,
    customerMode,
    setCustomerMode,
    foundCustomer,
    setFoundCustomer,
    conflictMsg,
    setConflictMsg,
    selectedServiceCategory,
    setSelectedServiceCategory,
    customerSuggestions,
    setCustomerSuggestions,
    availableSlots,
    setAvailableSlots,
    groupedServices,
    handleTransferToPOS,
    handleOpenCustomerProfile,
    handleActivateBooking,
    handleRescheduleBooking,
    canEditBooking,
    isBookingLate,
    handleDragStart,
    handleDrop,
    handleDragOver,
    handleChangeBookingStatus,
    confirmCancellation,
    checkConflict,
    checkCustomerDuplicate,
    fetchAvailableSlots,
    calculateEndTime,
    handlePhoneSearch,
    onPhoneChange,
    selectSuggestedCustomer,
    handleSaveBooking,
    handleWalkInPhoneSearch,
    selectWalkInCustomer,
    handleWalkInSubmit,
    openCreate,
    openEdit,
  } = useBookingsData();

  return (
    <div
      className="erp-page space-y-6 sm:space-y-8 pb-12 overflow-x-hidden"
      dir="rtl"
    >
      {/* ── HEADER WITH ALL ACTION TEXTS ALWAYS VISIBLE ── */}
      <PageHeader
        className={undefined}
        title="إدارة الحجوزات"
        subtitle="منظومة الحجوزات الشاملة المربوطة بنقطة البيع، لوحة الاستقبال، وسجل العملاء."
        badge={connected ? "متصل مباشر" : "غير متصل"}
        icon={Calendar}
        actions={
          <BookingsHeaderActions
            viewMode={viewMode}
            setViewMode={setViewMode}
            onNavigate={navigate}
            onWalkIn={() => setIsWalkInOpen(true)}
            onCreate={openCreate}
          />
        }
      />

      {/* ── SALON CAPACITY GAUGE ── */}
      <SalonCapacityBanner salonCapacity={salonCapacity} />

      {/* ── STATS OVERVIEW (CLICKABLE INTERACTIVE CARDS) ── */}
      <BookingsStatsGrid
        stats={stats}
        setActiveTab={setActiveTab}
        setQuickFilter={setQuickFilter}
      />

      {/* ── MAIN CONTENT CARD & TOOLBAR ── */}
      <PremiumCard noPadding className={undefined}>
        {/* Responsive Toolbar with Horizontal Scroll Support */}
        <BookingsToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          employees={employees}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
          tabCounts={tabCounts}
          connected={connected}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          refreshBookings={refreshBookings}
          searchInputRef={searchInputRef}
        />

        {/* View Grid / Board Content */}
        <BookingsBoardContent
          isLoading={appointmentsQuery.isLoading}
          viewMode={viewMode}
          filteredBookings={filteredBookings}
          employees={employees}
          openEdit={openEdit}
          handleChangeBookingStatus={handleChangeBookingStatus}
          handleActivateBooking={handleActivateBooking}
          handleTransferToPOS={handleTransferToPOS}
          handleOpenCustomerProfile={handleOpenCustomerProfile}
          handleRescheduleBooking={handleRescheduleBooking}
          canEditBooking={canEditBooking}
          actionLoading={actionLoading}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          handleDragOver={handleDragOver}
        />
      </PremiumCard>

      {/* ── ADVANCED BOOKING MODAL (RESPONSIVE DIALOG) ── */}
      <BookingFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingBooking={editingBooking}
        formData={formData}
        setFormData={setFormData}
        customerMode={customerMode}
        foundCustomer={foundCustomer}
        customerSuggestions={customerSuggestions}
        duplicateBooking={duplicateBooking}
        conflictMsg={conflictMsg}
        availableSlots={availableSlots}
        employees={employees}
        services={services}
        categories={categories}
        groupedServices={groupedServices}
        selectedServiceCategory={selectedServiceCategory}
        setSelectedServiceCategory={setSelectedServiceCategory}
        onPhoneChange={onPhoneChange}
        selectSuggestedCustomer={selectSuggestedCustomer}
        checkConflict={checkConflict}
        checkCustomerDuplicate={checkCustomerDuplicate}
        fetchAvailableSlots={fetchAvailableSlots}
        calculateEndTime={calculateEndTime}
        onSave={handleSaveBooking}
        saving={saving}
        phoneInputRef={phoneInputRef}
      />

      {/* ── WALK-IN CUSTOMER MODAL ── */}
      <WalkInDialog
        open={isWalkInOpen}
        onOpenChange={setIsWalkInOpen}
        walkInData={walkInData}
        setWalkInData={setWalkInData}
        walkInCustomer={walkInCustomer}
        setWalkInCustomer={setWalkInCustomer}
        walkInSuggestions={walkInSuggestions}
        setWalkInSuggestions={setWalkInSuggestions}
        employees={employees}
        services={services}
        onPhoneSearch={handleWalkInPhoneSearch}
        onSelectCustomer={selectWalkInCustomer}
        onSubmit={handleWalkInSubmit}
        saving={walkInSaving}
      />
      <CancelBookingDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        bookingToCancel={bookingToCancel}
        cancellationReason={cancellationReason}
        setCancellationReason={setCancellationReason}
        onConfirm={confirmCancellation}
        saving={saving}
      />
    </div>
  );
}
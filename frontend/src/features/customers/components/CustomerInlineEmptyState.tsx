/** Customer inline empty state (moved from CustomerDetail page). */
export default function CustomerInlineEmptyState({ icon: Icon, title, description }: any) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
    >
      {Icon && (
        <div className="bg-soft p-5 rounded-[2rem] border border-border shadow-inner mb-4">
          {Icon}
        </div>
      )}
      <h3 className="text-sm font-black text-main mb-1">{title}</h3>
      <p className="text-xs font-bold text-muted max-w-xs">{description}</p>
    </div>
  );
}

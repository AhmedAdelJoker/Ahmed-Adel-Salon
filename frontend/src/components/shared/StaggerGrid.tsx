import FadeIn from "@/components/shared/FadeIn";

export interface StaggerGridProps<T = { id?: string | number; key?: string | number; [key: string]: unknown }> {
  items?: T[];
  renderItem?: (item: T, index: number) => React.ReactNode;
  className?: string;
  step?: number;
}

export default function StaggerGrid<T extends { id?: string | number; key?: string | number; [key: string]: unknown } = { id?: string | number; key?: string | number; [key: string]: unknown }>({
  items = [],
  renderItem,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
  step = 80,
}: StaggerGridProps<T>) {
  return (
    <div className={className} dir="rtl">
      {items.map((item, index) => (
        <FadeIn key={item?.id ?? item?.key ?? index} delay={index * step}>
          {renderItem?.(item, index)}
        </FadeIn>
      ))}
    </div>
  );
}

import { useEffect } from 'react';
import FadeIn from "./FadeIn";

export default function StaggerGrid({
  items = [],
  renderItem,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
  step = 80,
}) {
  


return (

    <div className={className} dir="rtl">
      {items.map((item, index) => (
        <FadeIn key={item?.id ?? item?.key ?? index} delay={index * step}>
          {renderItem(item, index)}
        </FadeIn>
      ))}
    </div>
  );
}



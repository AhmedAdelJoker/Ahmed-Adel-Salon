import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/core/utils";

export default function LazyImage({
  src,
  alt = "",
  className = "",
  placeholderClassName = "",
  fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e5e7eb'%3E%3Crect width='100' height='100'/%3E%3C/svg%3E",
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={imgRef}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {!isLoaded && (
        <div
          className={cn(
            "absolute inset-0 animate-pulse bg-soft/50",
            placeholderClassName,
          )}
        />
      )}
      {isInView && (
        <img
          src={hasError ? fallbackSrc : src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

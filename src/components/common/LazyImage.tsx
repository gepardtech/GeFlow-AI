import React, { useState, useEffect, useRef } from "react";

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /**
   * If true, bypasses lazy intersection check and loads immediately.
   * Use for critical viewport / above-the-fold hero images.
   */
  priority?: boolean;
  /**
   * Intersection observer rootMargin (e.g., '200px' to preload slightly before entering viewport).
   */
  rootMargin?: string;
  /**
   * Optional custom skeleton placeholder CSS classes.
   */
  placeholderClassName?: string;
  /**
   * Wrapper container CSS classes (e.g. aspect-ratio container).
   */
  containerClassName?: string;
}

/**
 * High-performance component-level LazyImage using native IntersectionObserver.
 * Prioritizes viewport images and defers off-screen asset loading with smooth fade-in
 * and skeleton loading state.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  priority = false,
  rootMargin = "200px",
  className = "",
  placeholderClassName = "",
  containerClassName = "",
  onLoad,
  onError,
  ...imgProps
}) => {
  const [isInView, setIsInView] = useState<boolean>(() => priority);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (priority || isInView) return;

    // Check if IntersectionObserver is supported
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority, isInView, rootMargin]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoaded(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${containerClassName}`}
    >
      {/* Skeleton Shimmer Placeholder shown until asset is fully decoded & loaded */}
      {!isLoaded && !hasError && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-muted/60 animate-pulse transition-opacity duration-300 pointer-events-none rounded-[inherit] ${placeholderClassName}`}
        />
      )}

      {isInView && (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? ({ fetchpriority: "high" } as any) : {})}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`transition-opacity duration-300 ease-out ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          {...imgProps}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-muted-foreground text-xs p-2 text-center">
          <span>Failed to load asset</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;

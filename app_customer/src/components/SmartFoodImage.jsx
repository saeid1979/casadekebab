import React, { useMemo, useState } from "react";
import {
  getFoodImageUrl,
  optimizeCloudinaryUrl,
} from "../utils/cloudinaryImage";

export default function SmartFoodImage({
  item,
  alt,
  eager = false,
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const originalUrl = getFoodImageUrl(item);

  const sources = useMemo(() => {
    if (!originalUrl) return null;

    return {
      small: optimizeCloudinaryUrl(originalUrl, 320, "eco"),
      medium: optimizeCloudinaryUrl(originalUrl, 480, "eco"),
      large: optimizeCloudinaryUrl(originalUrl, 720, "good"),
    };
  }, [originalUrl]);

  if (!sources || failed) {
    return (
      <div
        className={`smart-food-image smart-food-image--fallback ${className}`}
        role="img"
        aria-label={alt || "Imagen de comida"}
      >
        <span>🥙</span>
      </div>
    );
  }

  return (
    <div
      className={`smart-food-image ${loaded ? "is-loaded" : ""} ${className}`}
    >
      <div className="smart-food-image__skeleton" aria-hidden="true" />

      <img
        src={sources.medium}
        srcSet={`${sources.small} 320w, ${sources.medium} 480w, ${sources.large} 720w`}
        sizes="(max-width: 520px) 92vw, (max-width: 900px) 46vw, 320px"
        alt={alt || item?.name_es || item?.name || "Comida"}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
        width="720"
        height="480"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

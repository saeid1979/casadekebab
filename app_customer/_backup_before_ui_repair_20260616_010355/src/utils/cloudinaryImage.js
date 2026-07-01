/**
 * Cloudinary URL optimizer for Casa de Kebab Turco.
 * It leaves non-Cloudinary URLs unchanged.
 */
export function optimizeCloudinaryUrl(url, width = 480, quality = "eco") {
  if (!url || typeof url !== "string") return "";

  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  const transformation = [
    "f_auto",
    `q_auto:${quality}`,
    "c_fill",
    "g_auto",
    `w_${Math.max(160, Number(width) || 480)}`,
  ].join(",");

  return url.replace("/image/upload/", `/image/upload/${transformation}/`);
}

export function getFoodImageUrl(item) {
  return (
    item?.image_url ||
    item?.image ||
    item?.photo_url ||
    item?.picture_url ||
    ""
  );
}

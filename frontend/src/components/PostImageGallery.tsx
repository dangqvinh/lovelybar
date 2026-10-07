export default function PostImageGallery({
  images,
  title,
  preview = false,
}: {
  images: string[];
  title: string;
  preview?: boolean;
}) {
  if (!images.length) return null;
  const visibleImages = preview ? images.slice(0, 4) : images;
  const hiddenCount = images.length - visibleImages.length;

  return (
    <div
      className={`grid grid-cols-2 gap-1 overflow-hidden ${
        visibleImages.length === 1 ? "grid-cols-1" : ""
      }`}
    >
      {visibleImages.map((image, index) => (
        <div key={`${image}-${index}`} className="relative aspect-square bg-pink-50">
          <img
            src={image}
            alt={`${title} - ảnh ${index + 1}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {preview && index === visibleImages.length - 1 && hiddenCount > 0 && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 text-3xl font-bold text-white">
              +{hiddenCount}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
  const collageImages = visibleImages.slice(0, 4);
  const remainingImages = preview ? [] : visibleImages.slice(4);

  function layoutClass(count: number) {
    if (count === 1) return "aspect-[4/3] grid-cols-1";
    if (count === 2) return "aspect-[4/3] grid-cols-2";
    if (count === 3) return "aspect-square grid-cols-[2fr_1fr] grid-rows-2";
    return "aspect-square grid-cols-2 grid-rows-2";
  }

  return (
    <div className="space-y-1">
      <div className={`grid gap-1 overflow-hidden ${layoutClass(collageImages.length)}`}>
        {collageImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className={`relative min-h-0 overflow-hidden bg-pink-50 ${
              collageImages.length === 3 && index === 0 ? "row-span-2" : ""
            }`}
          >
            <img
              src={image}
              alt={`${title} - ảnh ${index + 1}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {preview && index === 3 && hiddenCount > 0 && (
              <div className="absolute inset-0 grid place-items-center bg-black/55 text-3xl font-bold text-white">
                +{hiddenCount}
              </div>
            )}
          </div>
        ))}
      </div>
      {remainingImages.length > 0 && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {remainingImages.map((image, index) => (
            <div
              key={`${image}-${index + 4}`}
              className="relative aspect-square overflow-hidden bg-pink-50"
            >
              <img
                src={image}
                alt={`${title} - ảnh ${index + 5}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

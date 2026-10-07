import { useEffect, useState } from "react";

export default function PostImageGallery({
  images,
  title,
  preview = false,
}: {
  images: string[];
  title: string;
  preview?: boolean;
}) {
  const visibleImages = preview ? images.slice(0, 4) : images;
  const hiddenCount = images.length - visibleImages.length;
  const collageImages = visibleImages.slice(0, 4);
  const remainingImages = preview ? [] : visibleImages.slice(4);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") {
        setActiveIndex((index) =>
          index === null ? null : (index - 1 + images.length) % images.length,
        );
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((index) =>
          index === null ? null : (index + 1) % images.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  if (!images.length) return null;

  function openImage(index: number) {
    setActiveIndex(index);
  }

  function changeImage(direction: -1 | 1) {
    setActiveIndex((index) =>
      index === null ? null : (index + direction + images.length) % images.length,
    );
  }

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
            className={`relative min-h-0 overflow-hidden bg-pink-50 ${collageImages.length === 3 && index === 0 ? "row-span-2" : ""}`}
          >
            <button
              type="button"
              onClick={() => openImage(index)}
              className="absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label={`Xem ảnh ${index + 1} của ${title}`}
            >
              <img
                src={image}
                alt={`${title} - ảnh ${index + 1}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {preview && index === 3 && hiddenCount > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-3xl font-bold text-white">
                  +{hiddenCount}
                </span>
              )}
            </button>
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
              <button
                type="button"
                onClick={() => openImage(index + 4)}
                className="absolute inset-0 h-full w-full cursor-zoom-in"
                aria-label={`Xem ảnh ${index + 5} của ${title}`}
              >
                <img
                  src={image}
                  alt={`${title} - ảnh ${index + 5}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            </div>
          ))}
        </div>
      )}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} - ảnh ${activeIndex + 1} trên ${images.length}`}
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-3xl leading-none text-white transition hover:bg-white/25"
            onClick={() => setActiveIndex(null)}
            aria-label="Đóng ảnh"
          >
            ×
          </button>
          <button
            type="button"
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-3xl text-white transition hover:bg-white/25 sm:left-6"
            onClick={(event) => {
              event.stopPropagation();
              changeImage(-1);
            }}
            aria-label="Ảnh trước"
          >
            ‹
          </button>
          <div
            className="flex max-h-full max-w-full flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={images[activeIndex]}
              alt={`${title} - ảnh ${activeIndex + 1}`}
              className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-7rem)] object-contain"
            />
            <p className="text-sm font-medium text-white/90">
              {activeIndex + 1} / {images.length}
            </p>
          </div>
          <button
            type="button"
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-3xl text-white transition hover:bg-white/25 sm:right-6"
            onClick={(event) => {
              event.stopPropagation();
              changeImage(1);
            }}
            aria-label="Ảnh tiếp theo"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

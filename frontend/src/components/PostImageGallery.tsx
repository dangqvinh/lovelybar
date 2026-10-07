export default function PostImageGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  if (!images.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map((image, index) => (
        <div
          key={image}
          className="aspect-square overflow-hidden rounded-2xl bg-pink-50"
        >
          <img
            src={image}
            alt={`${title} - ảnh ${index + 1}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

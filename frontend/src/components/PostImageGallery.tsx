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
        <img
          key={image}
          src={image}
          alt={`${title} - ảnh ${index + 1}`}
          loading="lazy"
          className="max-h-[32rem] w-full rounded-2xl object-contain"
        />
      ))}
    </div>
  );
}

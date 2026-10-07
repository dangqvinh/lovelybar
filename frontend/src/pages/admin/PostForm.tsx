import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_IMAGES = 20;

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const { data, loading, error, reload } = useAsync(
    () => (id ? api.admin.post(id) : Promise.resolve(null)),
    [id],
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [busy, setBusy] = useState(false);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setContent(data.content);
    setImages(data.images);
  }, [data]);

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    },
    [],
  );

  if (loading) return <Spinner label="Đang tải bài đăng" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (editing && !data) {
    return <ErrorState message="Không tìm thấy bài đăng cần chỉnh sửa." />;
  }

  function removePreview(preview: ImagePreview) {
    URL.revokeObjectURL(preview.url);
    previewUrls.current.delete(preview.url);
    setImagePreviews((current) => current.filter((item) => item.id !== preview.id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > MAX_TITLE_LENGTH) {
      toast.error(`Tiêu đề phải có từ 1 đến ${MAX_TITLE_LENGTH} ký tự.`);
      return;
    }
    if (!content.trim() || content.length > MAX_CONTENT_LENGTH) {
      toast.error(`Nội dung phải có từ 1 đến ${MAX_CONTENT_LENGTH} ký tự.`);
      return;
    }

    const invalidFile = imagePreviews.find(
      ({ file }) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > MAX_IMAGE_SIZE,
    );
    if (invalidFile) {
      toast.error("Ảnh phải là JPG, PNG hoặc WEBP và dung lượng tối đa 2 MB.");
      return;
    }

    setBusy(true);
    let uploadedImages: string[] = [];
    try {
      uploadedImages = await api.admin.uploadPostImages(
        imagePreviews.map(({ file }) => file),
      );
      const nextImages = [...images, ...uploadedImages];
      const post = { title: cleanTitle, content, images: nextImages };
      if (editing && id) {
        await api.admin.updatePost(Number(id), post);
      } else {
        await api.admin.createPost(post);
      }

      const removedImages =
        data?.images.filter((image) => !images.includes(image)) ?? [];
      if (removedImages.length) {
        try {
          await api.admin.deletePostImages(removedImages);
        } catch (cleanupError) {
          toast.error(
            `Đã lưu bài đăng nhưng không thể xóa ảnh đã gỡ: ${(cleanupError as Error).message}`,
          );
          navigate("/admin/posts");
          return;
        }
      }
      toast.success(editing ? "Đã cập nhật bài đăng" : "Đã đăng bài mới");
      navigate("/admin/posts");
    } catch (e) {
      let message = (e as Error).message;
      if (uploadedImages.length) {
        try {
          await api.admin.deletePostImages(uploadedImages);
        } catch (cleanupError) {
          message += ` Không thể dọn các ảnh vừa tải lên: ${(cleanupError as Error).message}`;
        }
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/posts"
        className="text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Quay lại danh sách bài đăng
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-extrabold">
        {editing ? "Chỉnh sửa bài đăng" : "Viết bài đăng"}
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-7">
        <label className="block">
          <span className="label">Tiêu đề</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            required
            autoFocus
            placeholder="Nhập tiêu đề bài đăng"
          />
          <span className="mt-1 block text-right text-xs text-ink-soft">
            {title.length}/{MAX_TITLE_LENGTH}
          </span>
        </label>

        <label className="block">
          <span className="label">Nội dung</span>
          <textarea
            className="input min-h-64 resize-y"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            required
            placeholder="Nhập nội dung bài đăng"
          />
          <span className="mt-1 block text-right text-xs text-ink-soft">
            {content.length}/{MAX_CONTENT_LENGTH}
          </span>
        </label>

        <div>
          <span className="label">Ảnh bài đăng (không bắt buộc)</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <div
                key={image}
                className="relative overflow-hidden rounded-2xl border border-line"
              >
                <img
                  src={image}
                  alt={`Ảnh ${index + 1} của bài đăng`}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  className="btn-danger absolute right-2 top-2 !min-h-9 !px-3 !py-1"
                  onClick={() =>
                    setImages((current) => current.filter((item) => item !== image))
                  }
                  aria-label={`Gỡ ảnh ${index + 1}`}
                >
                  Gỡ
                </button>
              </div>
            ))}
            {imagePreviews.map((preview, index) => (
              <div
                key={preview.id}
                className="relative overflow-hidden rounded-2xl border border-line"
              >
                <img
                  src={preview.url}
                  alt={`Ảnh mới ${index + 1} của bài đăng`}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  className="btn-danger absolute right-2 top-2 !min-h-9 !px-3 !py-1"
                  onClick={() => removePreview(preview)}
                  aria-label={`Gỡ ảnh mới ${index + 1}`}
                >
                  Gỡ
                </button>
              </div>
            ))}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="input mt-3"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const remaining = MAX_IMAGES - images.length - imagePreviews.length;
              if (files.length > remaining) {
                toast.error(`Mỗi bài đăng chỉ được có tối đa ${MAX_IMAGES} ảnh.`);
                event.target.value = "";
                return;
              }
              const previews = files.map((file) => {
                const url = URL.createObjectURL(file);
                previewUrls.current.add(url);
                return { id: crypto.randomUUID(), file, url };
              });
              setImagePreviews((current) => [...current, ...previews]);
              event.target.value = "";
            }}
          />
          <p className="mt-1 text-xs text-ink-soft">
            Tối đa {MAX_IMAGES} ảnh mỗi bài. Chấp nhận JPG, PNG, WEBP; mỗi ảnh tối đa 2 MB.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Link to="/admin/posts" className="btn-outline">
            Hủy
          </Link>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy
              ? "Đang lưu..."
              : editing
                ? "Lưu thay đổi"
                : "Đăng bài"}
          </button>
        </div>
      </form>
    </div>
  );
}

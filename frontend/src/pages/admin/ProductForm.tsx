import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import ProductImage from "../../components/ProductImage";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { Product, ProductStatus } from "../../types";

const MAX_IMAGE = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProductForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useAsync<Product | null>(
    () => (id ? api.admin.product(id) : Promise.resolve(null)),
    [id],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<ProductStatus>("AVAILABLE");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setName(p.name);
    setDescription(p.description);
    setPrice(String(p.price));
    setStatus(p.status);
  }, [existing.data]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type))
      return toast.error("Ảnh phải có định dạng JPG, PNG hoặc WEBP");
    if (f.size > MAX_IMAGE) return toast.error("Dung lượng ảnh tối đa là 2 MB");
    setFile(f);
    setRemoveImage(false);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Vui lòng nhập tên sản phẩm";
    const n = Number(price);
    if (price.trim() === "" || !Number.isInteger(n) || n < 0)
      e.price = "Giá phải là số nguyên lớn hơn hoặc bằng 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        status,
      };
      const saved = editing
        ? await api.admin.updateProduct(Number(id), input)
        : await api.admin.createProduct(input);
      toast.success(
        editing ? "Cập nhật sản phẩm thành công" : "Tạo sản phẩm thành công",
      );
      try {
        if (file) await api.admin.uploadImage(saved.id, file);
        else if (removeImage && existing.data?.image)
          await api.admin.deleteImage(saved.id);
      } catch (e) {
        // The product exists; only the image failed. Send the admin to edit so they can retry.
        toast.error(
          `Đã lưu sản phẩm nhưng tải ảnh thất bại: ${(e as Error).message}`,
        );
        return navigate(`/admin/products/${saved.id}/edit`);
      }
      navigate("/admin/products");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (editing && existing.loading) return <Spinner label="Đang tải sản phẩm" />;
  if (editing && (existing.error || !existing.data))
    return (
      <ErrorState
        message={existing.error ?? "Không tìm thấy sản phẩm"}
        onRetry={existing.reload}
      />
    );

  const currentImage = removeImage ? null : (existing.data?.image ?? null);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/admin/products"
        className="mb-4 inline-block text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Sản phẩm
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold">
        {editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}
      </h1>

      <form onSubmit={save} className="card space-y-5 p-5 sm:p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">
            Tên sản phẩm
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="desc" className="label">
            Mô tả
          </label>
          <textarea
            id="desc"
            className="input min-h-28"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="label">
              Giá (₫)
            </label>
            <input
              id="price"
              className="input"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              aria-invalid={!!errors.price}
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>
          <div>
            <label htmlFor="status" className="label">
              Trạng thái
            </label>
            <select
              id="status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
            >
              <option value="AVAILABLE">
                Đang bán (hiển thị trong cửa hàng)
              </option>
              <option value="HIDDEN">Đang ẩn (không hiển thị)</option>
            </select>
          </div>
        </div>

        <div>
          <span className="label">Hình ảnh</span>
          <div className="flex flex-wrap items-center gap-4">
            {preview ? (
              <img
                src={preview}
                alt="Ảnh xem trước sản phẩm mới"
                className="h-28 w-28 rounded-2xl bg-pink-50 object-contain"
              />
            ) : (
              <ProductImage
                src={currentImage}
                name={name || "Sản phẩm"}
                className="h-28 w-28 rounded-2xl"
                fit="contain"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
                aria-label="Chọn ảnh"
              />
              <button
                type="button"
                className="btn-soft"
                onClick={() => fileRef.current?.click()}
              >
                {preview || currentImage ? "Đổi ảnh" : "Tải ảnh lên"}
              </button>
              {(preview || currentImage) && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    setFile(null);
                    setRemoveImage(true);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Xóa ảnh
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Ảnh JPG, PNG hoặc WEBP, tối đa 2 MB. Thay đổi được áp dụng khi bạn
            lưu.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/admin/products" className="btn-outline">
            Hủy
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}

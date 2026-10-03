import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import ProductImage from "../components/ProductImage";
import QuantityStepper from "../components/QuantityStepper";
import { ErrorState, Spinner } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { useCart } from "../store/cart";
import { formatVND } from "../utils/format";

export default function ProductDetail() {
  const { id = "" } = useParams();
  const {
    data: p,
    loading,
    error,
    reload,
  } = useAsync(() => api.product(id), [id]);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);

  if (loading) return <Spinner label="Đang tải sản phẩm" />;
  if (error || !p)
    return (
      <ErrorState
        message={error ?? "Không tìm thấy sản phẩm"}
        onRetry={reload}
      />
    );

  return (
    <div>
      <Link
        to="/products"
        className="mb-5 inline-block text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Tất cả sản phẩm
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden">
          <ProductImage
            src={p.image}
            name={p.name}
            className="aspect-square w-full"
          />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-extrabold">{p.name}</h1>
          <p className="mt-3 text-3xl font-extrabold text-pink-600">
            {formatVND(p.price)}
          </p>
          <p className="mt-4 whitespace-pre-line text-ink-soft">
            {p.description || "Chưa có mô tả."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <QuantityStepper value={qty} onChange={setQty} />
            <button
              className="btn-primary !px-8 !py-3"
              onClick={() => {
                add(p, qty);
                toast.success(`Đã thêm ${qty} × ${p.name} vào giỏ hàng`);
              }}
            >
              Thêm vào giỏ · {formatVND(p.price * qty)}
            </button>
          </div>
          <Link
            to="/cart"
            className="mt-4 text-sm font-semibold text-pink-600 hover:underline"
          >
            Đến giỏ hàng
          </Link>
        </div>
      </div>
    </div>
  );
}

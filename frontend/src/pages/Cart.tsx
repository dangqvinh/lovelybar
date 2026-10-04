import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../services/api";
import ProductImage from "../components/ProductImage";
import QuantityStepper from "../components/QuantityStepper";
import { EmptyState } from "../components/States";
import { cartTotal, subtotal, useCart } from "../store/cart";
import { formatVND } from "../utils/format";

export default function Cart() {
  const { items, setQuantity, remove, clear } = useCart();
  const navigate = useNavigate();
  const [creatingOrder, setCreatingOrder] = useState(false);
  const total = cartTotal(items);

  async function proceedToCheckout() {
    if (creatingOrder || items.length === 0) return;
    setCreatingOrder(true);
    try {
      const order = await api.createOrder(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
      clear();
      navigate(`/checkout?order=${encodeURIComponent(order.orderCode)}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCreatingOrder(false);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Giỏ hàng đang trống"
        text="Thêm món bạn yêu thích, sản phẩm sẽ xuất hiện tại đây."
        action={
          <Link to="/products" className="btn-primary">
            Xem sản phẩm
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Giỏ hàng</h1>
        <button
          className="text-sm font-semibold text-ink-soft hover:text-red-600"
          onClick={() => {
            clear();
            toast.success("Đã xóa toàn bộ giỏ hàng");
          }}
        >
          Xóa giỏ hàng
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.productId} className="card flex gap-4 p-3 sm:p-4">
              <ProductImage
                src={i.image}
                name={i.name}
                className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24"
              />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{i.name}</p>
                    <p className="text-sm text-ink-soft">
                      {formatVND(i.price)} / sản phẩm
                    </p>
                  </div>
                  <button
                    className="text-sm font-semibold text-ink-soft hover:text-red-600"
                    onClick={() => remove(i.productId)}
                    aria-label={`Xóa ${i.name}`}
                  >
                    Xóa
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <QuantityStepper
                    size="sm"
                    value={i.quantity}
                    onChange={(q) => setQuantity(i.productId, q)}
                  />
                  <p className="font-extrabold text-pink-600">
                    {formatVND(subtotal(i))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <p className="text-sm text-ink-soft">Tổng cộng</p>
          <p className="text-3xl font-extrabold text-pink-600">
            {formatVND(total)}
          </p>
          <button
            className="btn-primary mt-5 w-full !py-3"
            onClick={proceedToCheckout}
            disabled={creatingOrder}
          >
            {creatingOrder ? "Đang tạo đơn hàng…" : "Tạo đơn & thanh toán"}
          </button>
          <Link
            to="/products"
            className="mt-3 block text-center text-sm font-semibold text-pink-600 hover:underline"
          >
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </div>
  );
}

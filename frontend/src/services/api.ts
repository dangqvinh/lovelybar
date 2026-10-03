import type {
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductInput,
  QRResult,
  Stats,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {}

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  "Something went wrong. Please try again.": "Đã xảy ra lỗi. Vui lòng thử lại.",
  "Not found": "Không tìm thấy nội dung yêu cầu.",
  "Invalid id": "Mã định danh không hợp lệ.",
  "Invalid request body": "Dữ liệu gửi lên không hợp lệ.",
  "Choose an image file to upload (max 2 MB)":
    "Vui lòng chọn ảnh có dung lượng tối đa 2 MB.",
  "Product name is required": "Vui lòng nhập tên sản phẩm.",
  "Product name must be at most 200 characters":
    "Tên sản phẩm không được vượt quá 200 ký tự.",
  "Description must be at most 2000 characters":
    "Mô tả không được vượt quá 2.000 ký tự.",
  "Price must be between 0 and 1,000,000,000":
    "Giá phải từ 0 đến 1.000.000.000 ₫.",
  "Status must be AVAILABLE or HIDDEN": "Trạng thái sản phẩm không hợp lệ.",
  "Image must be 2 MB or smaller": "Dung lượng ảnh tối đa là 2 MB.",
  "Image must be JPG, PNG or WEBP": "Ảnh phải có định dạng JPG, PNG hoặc WEBP.",
  "Product not found": "Không tìm thấy sản phẩm.",
  "Order not found": "Không tìm thấy đơn hàng.",
  "Cart is empty": "Giỏ hàng đang trống.",
  "Too many different products in one order":
    "Đơn hàng có quá nhiều loại sản phẩm.",
  "A product in your cart is no longer available":
    "Một sản phẩm trong giỏ hàng hiện không còn bán.",
  "Invalid status filter": "Bộ lọc trạng thái không hợp lệ.",
  "Status must be PENDING, COMPLETED or CANCELLED":
    "Trạng thái đơn hàng không hợp lệ.",
  "Unsupported payment method": "Phương thức thanh toán không được hỗ trợ.",
  "orderCode is required": "Vui lòng cung cấp mã đơn hàng.",
  "This order was cancelled": "Đơn hàng này đã bị hủy.",
  "Could not generate a QR code for this payment method":
    "Không thể tạo mã QR cho phương thức thanh toán này.",
};

function translateApiMessage(message: string): string {
  const quantityError = message.match(/^Quantity must be between 1 and (\d+)$/);
  if (quantityError) return `Số lượng phải từ 1 đến ${quantityError[1]}.`;
  return API_ERROR_TRANSLATIONS[message] ?? message;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError(
      "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.",
    );
  }
  let body: { success?: boolean; message?: string; data?: T } | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body?.success) {
    const message = body?.message ?? "Something went wrong. Please try again.";
    throw new ApiError(translateApiMessage(message));
  }
  return body.data as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  // public
  products: () => request<Product[]>("/api/products"),
  product: (id: number | string) => request<Product>(`/api/products/${id}`),
  paymentMethods: () =>
    request<{ methods: PaymentMethod[] }>("/api/payment/methods").then(
      (r) => r.methods,
    ),
  // Only ids and quantities are sent. The backend prices the order.
  createOrder: (items: { productId: number; quantity: number }[]) =>
    request<Order>("/api/orders", json("POST", { items })),
  order: (code: string) =>
    request<Order>(`/api/orders/${encodeURIComponent(code)}`),
  generateQR: (orderCode: string, paymentMethod: string, bankCode?: string) =>
    request<QRResult>(
      "/api/payment/qr",
      json("POST", { orderCode, paymentMethod, bankCode }),
    ),

  // admin
  admin: {
    dashboard: () => request<Stats>("/api/admin/dashboard"),
    products: () => request<Product[]>("/api/admin/products"),
    product: (id: number | string) =>
      request<Product>(`/api/admin/products/${id}`),
    createProduct: (p: ProductInput) =>
      request<Product>("/api/admin/products", json("POST", p)),
    updateProduct: (id: number, p: ProductInput) =>
      request<Product>(`/api/admin/products/${id}`, json("PUT", p)),
    deleteProduct: (id: number) =>
      request<{ deleted: boolean }>(
        `/api/admin/products/${id}`,
        json("DELETE"),
      ),
    uploadImage: (id: number, file: File) => {
      const form = new FormData();
      form.append("image", file);
      return request<Product>(`/api/admin/products/${id}/image`, {
        method: "POST",
        body: form,
      });
    },
    deleteImage: (id: number) =>
      request<Product>(`/api/admin/products/${id}/image`, json("DELETE")),
    orders: (status = "") =>
      request<Order[]>(`/api/admin/orders${status ? `?status=${status}` : ""}`),
    order: (id: number) => request<Order>(`/api/admin/orders/${id}`),
    setOrderStatus: (id: number, status: OrderStatus) =>
      request<Order>(`/api/admin/orders/${id}/status`, json("PUT", { status })),
  },
};

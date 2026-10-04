import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductInput,
  ProductSalesReportRow,
  QRResult,
  SalesReportRow,
  Stats,
} from "../types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

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

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      "Vui lòng cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trước khi sử dụng ứng dụng.",
    );
  }
}

async function request<T>(
  loader: () => Promise<{ data: T | null; error: { message?: string } | null }>,
): Promise<T> {
  try {
    ensureConfigured();
    const { data, error } = await loader();
    if (error) {
      throw new Error(error.message ?? "Something went wrong. Please try again.");
    }
    return (data ?? (undefined as unknown as T)) as T;
  } catch (error) {
    const message =
      error instanceof Error
        ? translateApiMessage(error.message)
        : "Something went wrong. Please try again.";
    throw new ApiError(message);
  }
}

function toProduct(row: any): Product {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price ?? 0),
    image: row.image ?? null,
    status: row.status,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
}

function toOrderItem(row: any): OrderItem {
  return {
    id: Number(row.id),
    productId: row.product_id ?? row.productId ?? null,
    productName: row.product_name ?? row.productName ?? "",
    unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
    quantity: Number(row.quantity ?? 0),
    subtotal: Number(row.subtotal ?? 0),
  };
}

function toOrder(row: any): Order {
  return {
    id: Number(row.id),
    orderCode: row.order_code ?? row.orderCode ?? "",
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    paymentMethod: row.payment_method ?? row.paymentMethod ?? "BANK",
    orderStatus: row.order_status ?? row.orderStatus ?? "PENDING",
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
    items: Array.isArray(row.items) ? row.items.map(toOrderItem) : [],
  };
}

function toStats(row: any): Stats {
  return {
    totalProducts: Number(row.totalProducts ?? row.total_products ?? 0),
    totalOrders: Number(row.totalOrders ?? row.total_orders ?? 0),
    pendingOrders: Number(row.pendingOrders ?? row.pending_orders ?? 0),
    expectedRevenue: Number(row.expectedRevenue ?? row.expected_revenue ?? 0),
    recentOrders: Array.isArray(row.recentOrders)
      ? row.recentOrders.map(toOrder)
      : [],
  };
}

function toSalesReportRow(row: any): SalesReportRow {
  return {
    periodStart: row.periodStart ?? row.period_start,
    totalOrders: Number(row.totalOrders ?? row.total_orders ?? 0),
    pendingOrders: Number(row.pendingOrders ?? row.pending_orders ?? 0),
    completedOrders: Number(row.completedOrders ?? row.completed_orders ?? 0),
    expectedRevenue: Number(row.expectedRevenue ?? row.expected_revenue ?? 0),
    confirmedRevenue: Number(row.confirmedRevenue ?? row.confirmed_revenue ?? 0),
  };
}

function toProductSalesReportRow(row: any): ProductSalesReportRow {
  return {
    productName: row.productName ?? row.product_name ?? "",
    quantitySold: Number(row.quantitySold ?? row.quantity_sold ?? 0),
    orderCount: Number(row.orderCount ?? row.order_count ?? 0),
    confirmedRevenue: Number(row.confirmedRevenue ?? row.confirmed_revenue ?? 0),
  };
}

export const api = {
  products: () =>
    request<Product[]>(async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "AVAILABLE")
        .order("created_at", { ascending: false });
      return { data: (data ?? []).map(toProduct), error };
    }),

  product: (id: number | string) =>
    request<Product>(async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", Number(id))
        .maybeSingle();
      return { data: data ? toProduct(data) : null, error };
    }),

  paymentMethods: () =>
    Promise.resolve([
      { type: "BANK", code: "BANK", name: "Chuyển khoản ngân hàng (VietQR)" },
    ] as PaymentMethod[]),

  createOrder: (items: { productId: number; quantity: number }[]) =>
    request<Order>(async () => {
      const { data, error } = await supabase.rpc("create_order", { items });
      return { data: data ? toOrder(data) : null, error };
    }),

  order: (code: string) =>
    request<Order>(async () => {
      const { data, error } = await supabase.rpc("get_order", { code });
      return { data: data ? toOrder(data) : null, error };
    }),

  generateQR: async (orderCode: string, paymentMethod: string) => {
    return request<QRResult>(async () => {
      const { data, error } = await supabase.functions.invoke("payment-qr", {
        body: { orderCode, paymentMethod: paymentMethod || "BANK" },
      });
      if (error) return { data: null, error };
      if (!data?.qrPayload || !Number.isSafeInteger(Number(data.amount)) || Number(data.amount) <= 0) {
        return { data: null, error: { message: "Invalid payment QR response" } };
      }

      const amount = Number(data.amount);
      const { default: QRCode } = await import("qrcode");
      const qrCode = await QRCode.toDataURL(data.qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 640,
      });
      return {
        data: {
          orderId: Number(data?.orderId ?? 0),
          orderCode: data?.orderCode ?? orderCode,
          amount,
          paymentMethod: data?.paymentMethod ?? paymentMethod ?? "BANK",
          qrCode,
          bankName: data?.bankName,
          accountName: data?.accountName,
        } satisfies QRResult,
        error: null,
      };
    });
  },

  admin: {
    dashboard: () =>
      request<Stats>(async () => {
        const { data, error } = await supabase.rpc("admin_dashboard_stats");
        return { data: data ? toStats(data) : null, error };
      }),

    salesReport: (granularity: "day" | "month", fromDate: string, toDate: string) =>
      request<SalesReportRow[]>(async () => {
        const { data, error } = await supabase.rpc("admin_sales_report", {
          p_granularity: granularity,
          p_from_date: fromDate,
          p_to_date: toDate,
        });
        return {
          data: Array.isArray(data) ? data.map(toSalesReportRow) : null,
          error,
        };
      }),

    topProductsReport: (fromDate: string, toDate: string) =>
      request<ProductSalesReportRow[]>(async () => {
        const { data, error } = await supabase.rpc("admin_top_products_report", {
          p_from_date: fromDate,
          p_to_date: toDate,
        });
        return {
          data: Array.isArray(data) ? data.map(toProductSalesReportRow) : null,
          error,
        };
      }),

    products: () =>
      request<Product[]>(async () => {
        const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        return { data: (data ?? []).map(toProduct), error };
      }),

    product: (id: number | string) =>
      request<Product>(async () => {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();
        return { data: data ? toProduct(data) : null, error };
      }),

    createProduct: (p: ProductInput) =>
      request<Product>(async () => {
        const { data, error } = await supabase.from("products").insert({
          name: p.name,
          description: p.description,
          price: p.price,
          status: p.status,
        }).select("*").single();
        return { data: data ? toProduct(data) : null, error };
      }),

    updateProduct: (id: number, p: ProductInput) =>
      request<Product>(async () => {
        const { data, error } = await supabase
          .from("products")
          .update({
            name: p.name,
            description: p.description,
            price: p.price,
            status: p.status,
          })
          .eq("id", id)
          .select("*")
          .single();
        return { data: data ? toProduct(data) : null, error };
      }),

    deleteProduct: (id: number) =>
      request<{ deleted: boolean }>(async () => {
        const { error } = await supabase.from("products").delete().eq("id", id);
        return { data: { deleted: !error }, error };
      }),

    uploadImage: (id: number, file: File) =>
      request<Product>(async () => {
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, file, { upsert: true, cacheControl: '3600' });
        if (uploadError) {
          return { data: null, error: uploadError };
        }

        const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        const { data, error } = await supabase
          .from("products")
          .update({ image: publicUrlData.publicUrl })
          .eq("id", id)
          .select("*")
          .single();
        return { data: data ? toProduct(data) : null, error };
      }),

    deleteImage: (id: number) =>
      request<Product>(async () => {
        const { data: current, error: fetchError } = await supabase
          .from("products")
          .select("image")
          .eq("id", id)
          .single();
        if (fetchError) return { data: null, error: fetchError };

        const imagePath = current?.image;
        if (imagePath) {
          const objectPath = imagePath.split('/').pop() ?? '';
          if (objectPath) {
            await supabase.storage.from("product-images").remove([objectPath]);
          }
        }

        const { data, error } = await supabase
          .from("products")
          .update({ image: null })
          .eq("id", id)
          .select("*")
          .single();
        return { data: data ? toProduct(data) : null, error };
      }),

    orders: (status = "") =>
      request<Order[]>(async () => {
        const { data, error } = await supabase.rpc("admin_list_orders", {
          p_status: status || null,
        });
        return { data: Array.isArray(data) ? data.map(toOrder) : null, error };
      }),

    order: (id: number) =>
      request<Order>(async () => {
        const { data, error } = await supabase.rpc("admin_get_order", {
          p_order_id: id,
        });
        return { data: data ? toOrder(data) : null, error };
      }),

    setOrderStatus: (id: number, status: OrderStatus) =>
      request<Order>(async () => {
        const { data, error } = await supabase.rpc("admin_set_order_status", {
          p_order_id: id,
          p_status: status,
        });
        return { data: data ? toOrder(data) : null, error };
      }),
  },
};

// Keep the original API contract stable for the pages while using Supabase under the hood.

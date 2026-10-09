import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Post,
  PostComment,
  PostInteractions,
  PostInput,
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
  "Comment must be between 1 and 1000 characters":
    "Bình luận phải có từ 1 đến 1.000 ký tự.",
  "Comment to reply to was not found":
    "Không tìm thấy bình luận cần trả lời.",
  "Comment name must be 1 to 40 characters and cannot be Admin":
    "Tên phải có từ 1 đến 40 ký tự và không được dùng tên Admin.",
  "Comment not found": "Không tìm thấy bình luận.",
  "Invalid comment images":
    "Ảnh đính kèm không hợp lệ. Mỗi bình luận tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 2 MB.",
  "Invalid reaction": "Cảm xúc không hợp lệ.",
  "Post not found": "Không tìm thấy bài đăng.",
  "Admin access required": "Bạn không có quyền thực hiện thao tác này.",
  "Invalid comment edit token": "Mã chỉnh sửa bình luận không hợp lệ.",
  "Comment edit is not authorized":
    "Không thể chỉnh sửa bình luận này: mã không đúng hoặc bài viết không còn công khai.",
  "Comment delete is not authorized":
    "Không thể xóa bình luận này: mã không đúng hoặc bài viết không còn công khai.",
  "Comment edit token is unavailable":
    "Không tìm thấy mã sửa bình luận trên trình duyệt này. Có thể bạn đã xóa dữ liệu trình duyệt.",
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

function toPost(row: any): Post {
  return {
    id: Number(row.id),
    title: row.title,
    content: row.content,
    images: Array.isArray(row.images)
      ? row.images
      : row.image
        ? [row.image]
        : [],
    isPublished: Boolean(row.is_published ?? row.isPublished ?? true),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function getGuestId(): string {
  const storageKey = "lovelybar_guest_id";
  let guestId = localStorage.getItem(storageKey);
  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem(storageKey, guestId);
  }
  return guestId;
}

function commentSecretKey(commentId: number): string {
  return `lovelybar_comment_secret_${commentId}`;
}

const COMMENT_AUTHOR_SESSION_KEY = "lovelybar_comment_author";

function createCommentSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCommentSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getCommentSecret(commentId: number): string {
  const secret = localStorage.getItem(commentSecretKey(commentId));
  if (!secret) {
    throw new ApiError("Comment edit token is unavailable");
  }
  return secret;
}

function toPostComment(row: any): PostComment {
  const id = Number(row.id);
  const imagePaths: string[] = Array.isArray(row.images) ? row.images : [];
  const parentId = row.parentId ?? row.parent_id;
  return {
    id,
    parentId: parentId == null ? null : Number(parentId),
    author: row.author ?? "Khách",
    content: row.content,
    createdAt: row.createdAt ?? row.created_at,
    editedAt: row.editedAt ?? row.edited_at ?? null,
    canEdit: Boolean(localStorage.getItem(commentSecretKey(id))),
    images: imagePaths.map((path) =>
      path.startsWith("http")
        ? path
        : supabase.storage.from("post-comment-images").getPublicUrl(path).data.publicUrl,
    ),
    reactionCounts: row.reactionCounts ?? row.reaction_counts ?? {},
    myReaction: row.myReaction ?? row.my_reaction ?? null,
  };
}

function toPostInteractions(row: any): PostInteractions {
  const comments = row.comments ?? [];
  return {
    reactionCounts: row.reactionCounts ?? row.reaction_counts ?? {},
    myReaction: row.myReaction ?? row.my_reaction ?? null,
    comments: Array.isArray(comments) ? comments.map(toPostComment) : [],
    commentCount: Number(row.commentCount ?? row.comment_count ?? comments.length),
  };
}

function postImageObjectPaths(imageUrls: string[]): string[] {
  const marker = "/storage/v1/object/public/product-images/";
  return imageUrls.map((imageUrl) => {
    const pathname = new URL(imageUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) {
      throw new ApiError("Không xác định được đường dẫn ảnh bài đăng.");
    }
    const objectPath = decodeURIComponent(
      pathname.slice(markerIndex + marker.length),
    );
    if (!objectPath.startsWith("posts/")) {
      throw new ApiError("Đường dẫn ảnh bài đăng không hợp lệ.");
    }
    return objectPath;
  });
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
  getCommentAuthor: () => sessionStorage.getItem(COMMENT_AUTHOR_SESSION_KEY) ?? "",

  saveCommentAuthor: (author: string) =>
    sessionStorage.setItem(COMMENT_AUTHOR_SESSION_KEY, author),

  canEditPostComment: (commentId: number) =>
    Boolean(localStorage.getItem(commentSecretKey(commentId))),

  uploadPostCommentImages: (files: File[], postId: number) =>
    request<string[]>(async () => {
      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      if (files.length > 5) {
        return {
          data: null,
          error: { message: "Mỗi bình luận chỉ được đính kèm tối đa 5 ảnh." },
        };
      }
      const invalidFile = files.find(
        (file) => !extensions[file.type] || file.size > 2 * 1024 * 1024,
      );
      if (invalidFile) {
        return {
          data: null,
          error: {
            message: "Ảnh phải là JPG, PNG hoặc WEBP và có dung lượng tối đa 2 MB.",
          },
        };
      }

      const paths: string[] = [];
      for (const file of files) {
        const path = `posts/${postId}/${crypto.randomUUID()}.${extensions[file.type]}`;
        const { error } = await supabase.storage
          .from("post-comment-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) return { data: null, error };
        paths.push(path);
      }
      return { data: paths, error: null };
    }),

  postInteractions: (postId: number | string) =>
    request<PostInteractions>(async () => {
      const { data, error } = await supabase.rpc("get_post_interactions", {
        p_post_id: Number(postId),
        p_guest_id: getGuestId(),
      });
      return { data: data ? toPostInteractions(data) : null, error };
    }),

  addPostComment: (
    postId: number,
    content: string,
    parentId: number | null,
    files: File[],
    author: string,
  ) =>
    request<PostComment>(async () => {
      const imagePaths = await api.uploadPostCommentImages(files, postId);
      const secret = createCommentSecret();
      const editTokenHash = await hashCommentSecret(secret);
      const { data, error } = await supabase.rpc("add_post_comment", {
        p_post_id: postId,
        p_guest_id: getGuestId(),
        p_content: content,
        p_edit_token_hash: editTokenHash,
        p_parent_id: parentId,
        p_images: imagePaths,
        p_author: author,
      });
      if (error || !data) return { data: null, error };
      const comment = toPostComment(data);
      try {
        localStorage.setItem(commentSecretKey(comment.id), secret);
      } catch (storageError) {
        return {
          data: null,
          error: {
            message:
              `Bình luận đã được đăng nhưng không thể lưu quyền chỉnh sửa trên trình duyệt này: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
          },
        };
      }
      return { data: { ...comment, canEdit: true }, error: null };
    }),

  addAdminPostComment: (
    postId: number,
    content: string,
    parentId: number | null,
    files: File[],
  ) =>
    request<PostComment>(async () => {
      const imagePaths = await api.uploadPostCommentImages(files, postId);
      const { data, error } = await supabase.rpc("admin_add_post_comment", {
        p_post_id: postId,
        p_content: content,
        p_parent_id: parentId,
        p_images: imagePaths,
      });
      return { data: data ? toPostComment(data) : null, error };
    }),

  editPostComment: (commentId: number, content: string) =>
    request<PostComment>(async () => {
      const secret = getCommentSecret(commentId);
      const editTokenHash = await hashCommentSecret(secret);
      const { data, error } = await supabase.rpc("edit_guest_post_comment", {
        p_comment_id: commentId,
        p_edit_token_hash: editTokenHash,
        p_content: content,
      });
      return {
        data: data ? { ...toPostComment(data), canEdit: true } : null,
        error,
      };
    }),

  deleteGuestPostComment: (commentId: number) =>
    request<{ deleted: boolean }>(async () => {
      const secret = getCommentSecret(commentId);
      const editTokenHash = await hashCommentSecret(secret);
      const { data, error } = await supabase.rpc("delete_guest_post_comment", {
        p_comment_id: commentId,
        p_edit_token_hash: editTokenHash,
      });
      if (!error && !data) {
        return {
          data: { deleted: false },
          error: { message: "Comment delete is not authorized" },
        };
      }
      if (!error && data) localStorage.removeItem(commentSecretKey(commentId));
      return { data: { deleted: Boolean(data) }, error };
    }),

  setPostReaction: (postId: number, reaction: string | null) =>
    request<PostInteractions>(async () => {
      const { data, error } = await supabase.rpc("set_post_reaction", {
        p_post_id: postId,
        p_guest_id: getGuestId(),
        p_reaction: reaction,
      });
      return { data: data ? toPostInteractions(data) : null, error };
    }),

  setPostCommentReaction: (commentId: number, reaction: string | null) =>
    request<PostInteractions>(async () => {
      const { data, error } = await supabase.rpc("set_post_comment_reaction", {
        p_comment_id: commentId,
        p_guest_id: getGuestId(),
        p_reaction: reaction,
      });
      return { data: data ? toPostInteractions(data) : null, error };
    }),

  deletePostComment: (commentId: number) =>
    request<{ deleted: boolean }>(async () => {
      const { data, error } = await supabase.rpc("admin_delete_post_comment", {
        p_comment_id: commentId,
      });
      return { data: { deleted: Boolean(data) }, error };
    }),

  posts: () =>
    request<Post[]>(async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      return { data: (data ?? []).map(toPost), error };
    }),

  post: (id: number | string) =>
    request<Post>(async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", Number(id))
        .eq("is_published", true)
        .maybeSingle();
      return { data: data ? toPost(data) : null, error };
    }),

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
          accountNumber: data?.accountNumber,
          accountName: data?.accountName,
        } satisfies QRResult,
        error: null,
      };
    });
  },

  admin: {
    posts: () =>
      request<Post[]>(async () => {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });
        return { data: (data ?? []).map(toPost), error };
      }),

    post: (id: number | string) =>
      request<Post>(async () => {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();
        return { data: data ? toPost(data) : null, error };
      }),

    createPost: (post: PostInput) =>
      request<Post>(async () => {
        const { data, error } = await supabase
          .from("posts")
          .insert({ title: post.title, content: post.content, images: post.images })
          .select("*")
          .single();
        return { data: data ? toPost(data) : null, error };
      }),

    updatePost: (id: number, post: PostInput) =>
      request<Post>(async () => {
        const { data, error } = await supabase
          .from("posts")
          .update({ title: post.title, content: post.content, images: post.images })
          .eq("id", id)
          .select("*")
          .single();
        return { data: data ? toPost(data) : null, error };
      }),

    uploadPostImages: (files: File[]) =>
      request<string[]>(async () => {
        const extensions: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const invalidFile = files.find(
          (file) => !extensions[file.type] || file.size > 2 * 1024 * 1024,
        );
        if (invalidFile) {
          return {
            data: null,
            error: {
              message: "Ảnh bài đăng phải là JPG, PNG hoặc WEBP và tối đa 2 MB.",
            },
          };
        }

        const uploadedPaths: string[] = [];
        const publicUrls: string[] = [];
        for (const file of files) {
          const objectPath = `posts/${crypto.randomUUID()}.${extensions[file.type]}`;
          const { error } = await supabase.storage
            .from("product-images")
            .upload(objectPath, file, { cacheControl: "3600", upsert: false });
          if (error) {
            if (uploadedPaths.length) {
              const { error: cleanupError } = await supabase.storage
                .from("product-images")
                .remove(uploadedPaths);
              if (cleanupError) {
                return {
                  data: null,
                  error: {
                    message: `${error.message}; không thể dọn một số ảnh đã tải lên: ${cleanupError.message}`,
                  },
                };
              }
            }
            return { data: null, error };
          }
          uploadedPaths.push(objectPath);

          const { data } = supabase.storage
            .from("product-images")
            .getPublicUrl(objectPath);
          publicUrls.push(data.publicUrl);
        }
        return { data: publicUrls, error: null };
      }),

    deletePostImages: (imageUrls: string[]) =>
      request<{ deleted: boolean }>(async () => {
        if (!imageUrls.length) return { data: { deleted: true }, error: null };
        const objectPaths = postImageObjectPaths(imageUrls);
        const { error } = await supabase.storage
          .from("product-images")
          .remove(objectPaths);
        return { data: { deleted: !error }, error };
      }),

    setPostVisibility: (id: number, isPublished: boolean) =>
      request<Post>(async () => {
        const { data, error } = await supabase
          .from("posts")
          .update({ is_published: isPublished })
          .eq("id", id)
          .select("*")
          .single();
        return { data: data ? toPost(data) : null, error };
      }),

    deletePost: (id: number) =>
      request<Post | null>(async () => {
        const { data: post, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (fetchError) return { data: null, error: fetchError };
        if (!post) return { data: null, error: { message: "Không tìm thấy bài đăng." } };

        const { error } = await supabase.from("posts").delete().eq("id", id);
        if (error) return { data: null, error };
        const images: string[] = Array.isArray(post.images)
          ? post.images
          : post.image
            ? [post.image]
            : [];
        if (images.length) {
          const objectPaths = postImageObjectPaths(images);
          const { error: imageError } = await supabase.storage
            .from("product-images")
            .remove(objectPaths);
          if (imageError) {
            return {
              data: toPost(post),
              error: {
                message: `Bài đã xóa nhưng không thể xóa ảnh cũ: ${imageError.message}`,
              },
            };
          }
        }
        return { data: null, error: null };
      }),

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

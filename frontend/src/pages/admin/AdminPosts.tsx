import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ConfirmDialog";
import { EmptyState, ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { Post } from "../../types";
import { formatDate } from "../../utils/format";

export default function AdminPosts() {
  const { data, loading, error, reload } = useAsync(api.admin.posts);
  const [toDelete, setToDelete] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState<number | null>(null);

  async function toggleVisibility(post: Post) {
    setVisibilityBusy(post.id);
    try {
      await api.admin.setPostVisibility(post.id, !post.isPublished);
      toast.success(post.isPublished ? "Đã ẩn bài đăng" : "Đã hiển thị bài đăng");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVisibilityBusy(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.admin.deletePost(toDelete.id);
      toast.success("Đã xóa bài đăng");
      setToDelete(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
      setToDelete(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Bài đăng</h1>
        <Link to="/admin/posts/create" className="btn-primary">
          Viết bài
        </Link>
      </div>

      {loading ? (
        <Spinner label="Đang tải bài đăng" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          title="Chưa có bài đăng"
          text="Tạo bài đăng để chia sẻ thông tin với người dùng."
          action={
            <Link to="/admin/posts/create" className="btn-primary">
              Viết bài đầu tiên
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((post) => (
            <article
              key={post.id}
              className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                {post.images[0] && (
                  <div className="mb-3 flex items-center gap-2">
                    <img
                      src={post.images[0]}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    {post.images.length > 1 && (
                      <span className="text-xs text-ink-soft">
                        +{post.images.length - 1} ảnh
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-ink-soft">
                  {formatDate(post.createdAt)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold">{post.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      post.isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-ink/10 text-ink-soft"
                    }`}
                  >
                    {post.isPublished ? "Đang hiển thị" : "Đang ẩn"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-ink-soft">
                  {post.content}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  to={`/admin/posts/${post.id}`}
                  className="btn-outline !px-3 !py-1.5"
                >
                  Xem bài viết
                </Link>
                <Link
                  to={`/admin/posts/${post.id}/edit`}
                  className="btn-soft !px-3 !py-1.5"
                >
                  Sửa
                </Link>
                <button
                  type="button"
                  className="btn-outline !px-3 !py-1.5"
                  onClick={() => toggleVisibility(post)}
                  disabled={visibilityBusy === post.id}
                >
                  {visibilityBusy === post.id
                    ? "Đang lưu..."
                    : post.isPublished
                      ? "Ẩn"
                      : "Hiện"}
                </button>
                <button
                  type="button"
                  className="btn-danger !px-3 !py-1.5"
                  onClick={() => setToDelete(post)}
                >
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Xóa bài đăng này?"
        confirmLabel="Xóa"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        Bài “{toDelete?.title}” sẽ bị gỡ và người dùng không thể xem nữa.
      </ConfirmDialog>
    </div>
  );
}

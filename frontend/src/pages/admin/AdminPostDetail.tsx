import { Link, useParams } from "react-router-dom";
import PostImageGallery from "../../components/PostImageGallery";
import { EmptyState, ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import { formatDate } from "../../utils/format";

export default function AdminPostDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(
    () => api.admin.post(id ?? ""),
    [id],
  );

  if (loading) return <Spinner label="Đang tải bài đăng" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <EmptyState
        title="Không tìm thấy bài đăng"
        text="Bài đăng có thể đã bị xóa."
        action={
          <Link to="/admin/posts" className="btn-primary">
            Quay lại danh sách
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/posts"
          className="text-sm font-semibold text-pink-600 hover:underline"
        >
          ← Quay lại danh sách bài đăng
        </Link>
        <Link to={`/admin/posts/${data.id}/edit`} className="btn-primary">
          Chỉnh sửa
        </Link>
      </div>

      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center gap-3 px-5 py-4">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 p-[2px]"
            aria-hidden
          >
            <span className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-extrabold text-pink-600">
              LB
            </span>
          </div>
          <div>
            <p className="text-sm font-bold">LovelyBar · Quản trị</p>
            <p className="text-xs text-ink-soft">{formatDate(data.createdAt)}</p>
          </div>
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
              data.isPublished
                ? "bg-green-100 text-green-700"
                : "bg-ink/10 text-ink-soft"
            }`}
          >
            {data.isPublished ? "Đang hiển thị" : "Đang ẩn"}
          </span>
        </div>

        <div className="px-5 pb-4">
          <h1 className="text-2xl font-extrabold">{data.title}</h1>
          {data.content && (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink-soft">
              {data.content}
            </p>
          )}
        </div>

        <PostImageGallery images={data.images} title={data.title} />
      </article>
    </div>
  );
}

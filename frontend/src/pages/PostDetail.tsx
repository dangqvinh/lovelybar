import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import PostImageGallery from "../components/PostImageGallery";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { formatDate } from "../utils/format";

export default function PostDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(
    () => api.post(id ?? ""),
    [id],
  );

  if (loading) return <Spinner label="Đang tải bài đăng" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <EmptyState
        title="Không tìm thấy bài đăng"
        text="Bài đăng có thể đã bị gỡ."
        action={
          <Link to="/posts" className="btn-primary">
            Xem các bài đăng
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/posts"
        className="mb-4 inline-flex text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Bảng tin
      </Link>
      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 p-[2px]"
            aria-hidden
          >
            <span className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-extrabold text-pink-600">
              LB
            </span>
          </div>
          <div>
            <p className="text-sm font-bold">LovelyBar</p>
            <p className="text-xs text-ink-soft">
              {formatDate(data.createdAt)} · Công khai
            </p>
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <h1 className="text-xl font-extrabold">{data.title}</h1>
          {data.content && (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-soft">
              {data.content}
            </p>
          )}
        </div>
        <PostImageGallery images={data.images} title={data.title} />
        <div className="border-t border-line px-4 py-3 text-xs text-ink-soft sm:px-5">
          Bài đăng từ LovelyBar
        </div>
      </article>
    </div>
  );
}

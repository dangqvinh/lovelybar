import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, Spinner } from "../components/States";
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
    <article className="mx-auto max-w-3xl">
      <Link
        to="/posts"
        className="text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Tất cả bài đăng
      </Link>
      <p className="mt-6 text-sm text-ink-soft">{formatDate(data.createdAt)}</p>
      <h1 className="mt-2 text-3xl font-extrabold">{data.title}</h1>
      <div className="card mt-6 p-5 leading-7 text-ink-soft sm:p-8">
        {data.image && (
          <img
            src={data.image}
            alt={data.title}
            className="mb-6 max-h-[32rem] w-full rounded-2xl object-contain"
          />
        )}
        <p className="whitespace-pre-line">{data.content}</p>
      </div>
    </article>
  );
}

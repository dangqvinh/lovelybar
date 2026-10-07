import { Link } from "react-router-dom";
import PostImageGallery from "../components/PostImageGallery";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { formatDate } from "../utils/format";

export default function Posts() {
  const { data, loading, error, reload } = useAsync(api.posts);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">Bài đăng</h1>
      {loading ? (
        <Spinner label="Đang tải bài đăng" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          title="Chưa có bài đăng"
          text="Thông tin mới sẽ được cập nhật tại đây."
        />
      ) : (
        <div className="space-y-4">
          {data.map((post) => (
            <article key={post.id} className="card p-5 sm:p-6">
              <div className="mb-4">
                <PostImageGallery images={post.images} title={post.title} />
              </div>
              <p className="text-sm text-ink-soft">
                {formatDate(post.createdAt)}
              </p>
              <h2 className="mt-2 text-xl font-bold">{post.title}</h2>
              <p className="mt-3 line-clamp-4 whitespace-pre-line text-ink-soft">
                {post.content}
              </p>
              <Link
                to={`/posts/${post.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-pink-600 hover:underline"
              >
                Đọc tiếp
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

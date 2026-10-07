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
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="mx-auto w-full max-w-2xl space-y-5">
            {data.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
              >
                <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 p-[2px]"
                    aria-hidden
                  >
                    <span className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-extrabold text-pink-600">
                      LB
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">LovelyBar</p>
                    <div className="flex items-center gap-1 text-xs text-ink-soft">
                      <time dateTime={post.createdAt}>
                        {formatDate(post.createdAt)}
                      </time>
                      <span aria-hidden>·</span>
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-label="Công khai"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 sm:px-5">
                  <h2 className="text-lg font-bold leading-snug">{post.title}</h2>
                  {post.content && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-soft line-clamp-4">
                      {post.content}
                    </p>
                  )}
                </div>

                {post.images.length > 0 && (
                  <PostImageGallery
                    images={post.images}
                    title={post.title}
                    preview
                  />
                )}

                <div className="px-4 py-3 sm:px-5">
                  <Link
                    to={`/posts/${post.id}`}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-pink-50 px-4 text-sm font-bold text-pink-700 transition hover:bg-pink-100"
                  >
                    Xem bài viết
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <aside className="sticky top-24 hidden space-y-4 lg:block">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-pink-100 font-extrabold text-pink-600">
                  LB
                </span>
                <div>
                  <h2 className="font-bold">LovelyBar</h2>
                  <p className="text-xs text-ink-soft">Bảng tin cộng đồng</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Cập nhật tin mới, món ngon và những thông báo từ LovelyBar.
              </p>
            </div>
            <p className="px-2 text-xs leading-5 text-ink-soft">
              LovelyBar · Bài đăng được chia sẻ công khai với mọi người.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

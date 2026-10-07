import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ProductImage from "../components/ProductImage";
import PriceDisplay from "../components/PriceDisplay";
import SaleNotice from "../components/SaleNotice";
import {
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
  Spinner,
} from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { cartCount, useCart } from "../store/cart";
import { formatDate } from "../utils/format";

export default function Home() {
  const { data, loading, error, reload } = useAsync(api.products);
  const posts = useAsync(api.posts);
  const count = useCart((s) => cartCount(s.items));
  const featured = (data ?? []).slice(0, 4);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-4xl bg-pink-500 px-6 py-12 text-white sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-pink-400/60"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-pink-600/40"
          aria-hidden
        />
        <div className="relative grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Minibar C302
            </h1>
            <p className="mt-4 max-w-md text-pink-50">
              LovelyBar là cửa hàng nội bộ của chúng ta. Chọn món yêu thích,
              quét mã QR là hoàn tất.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="btn bg-white text-pink-700 shadow-soft hover:bg-pink-50"
              >
                Xem sản phẩm
              </Link>
              <Link
                to="/cart"
                className="btn border border-white/60 text-white hover:bg-white/10"
              >
                {count > 0 ? `Mở giỏ hàng (${count})` : "Mở giỏ hàng"}
              </Link>
            </div>
          </div>
          <div className="hidden justify-end gap-4 md:flex" aria-hidden>
            {featured.slice(0, 3).map((p, i) => (
              <div
                key={p.id}
                className={`w-36 overflow-hidden rounded-3xl bg-white p-2 text-ink shadow-lift ${i === 1 ? "mt-10" : i === 2 ? "-mt-2" : ""}`}
              >
                <ProductImage
                  src={p.image}
                  name={p.name}
                  className="aspect-square w-full rounded-2xl"
                />
                <p className="mt-2 truncate px-1 text-sm font-bold">{p.name}</p>
                <div className="px-1 pb-1">
                  <PriceDisplay
                    price={p.price}
                    className="text-sm font-semibold text-pink-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SaleNotice />

      <section>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-extrabold">Bài đăng mới</h2>
          <Link
            to="/posts"
            className="whitespace-nowrap text-sm font-semibold text-pink-600 hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        {posts.loading ? (
          <Spinner label="Đang tải bài đăng" />
        ) : posts.error ? (
          <ErrorState message={posts.error} onRetry={posts.reload} />
        ) : !posts.data?.length ? (
          <EmptyState
            title="Chưa có bài đăng"
            text="Thông tin mới sẽ được cập nhật tại đây."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {posts.data.slice(0, 3).map((post) => (
              <article key={post.id} className="card overflow-hidden">
                {post.image && (
                  <img
                    src={post.image}
                    alt={post.title}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                )}
                <div className="p-5">
                  <p className="text-xs font-medium text-ink-soft">
                    {formatDate(post.createdAt)}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{post.title}</h3>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-ink-soft">
                    {post.content}
                  </p>
                  <Link
                    to={`/posts/${post.id}`}
                    className="mt-4 inline-flex text-sm font-semibold text-pink-600 hover:underline"
                  >
                    Đọc bài đăng
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">Sản phẩm nổi bật</h2>
          <Link
            to="/products"
            className="text-sm font-semibold text-pink-600 hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : featured.length === 0 ? (
          <EmptyState
            title="Chưa có sản phẩm"
            text="Hãy quay lại sau nhé. Sản phẩm mới sẽ sớm được cập nhật."
          />
        ) : (
          <div className="product-grid grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

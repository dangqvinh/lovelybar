import ProductCard from "../components/ProductCard";
import {
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
} from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Products() {
  const { data, loading, error, reload } = useAsync(api.products);
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">Sản phẩm</h1>
      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Chưa có sản phẩm"
          text="Hiện chưa có sản phẩm nào. Vui lòng quay lại sau."
        />
      ) : (
        <div className="product-grid grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const { data, loading, error, reload } = useAsync(
    () => (id ? api.admin.post(id) : Promise.resolve(null)),
    [id],
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setContent(data.content);
  }, [data]);

  if (loading) return <Spinner label="Đang tải bài đăng" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (editing && !data) {
    return <ErrorState message="Không tìm thấy bài đăng cần chỉnh sửa." />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > MAX_TITLE_LENGTH) {
      toast.error(`Tiêu đề phải có từ 1 đến ${MAX_TITLE_LENGTH} ký tự.`);
      return;
    }
    if (!content.trim() || content.length > MAX_CONTENT_LENGTH) {
      toast.error(`Nội dung phải có từ 1 đến ${MAX_CONTENT_LENGTH} ký tự.`);
      return;
    }

    setBusy(true);
    try {
      const post = { title: cleanTitle, content };
      if (editing && id) {
        await api.admin.updatePost(Number(id), post);
        toast.success("Đã cập nhật bài đăng");
      } else {
        await api.admin.createPost(post);
        toast.success("Đã đăng bài mới");
      }
      navigate("/admin/posts");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/posts"
        className="text-sm font-semibold text-pink-600 hover:underline"
      >
        ← Quay lại danh sách bài đăng
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-extrabold">
        {editing ? "Chỉnh sửa bài đăng" : "Viết bài đăng"}
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-7">
        <label className="block">
          <span className="label">Tiêu đề</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            required
            autoFocus
            placeholder="Nhập tiêu đề bài đăng"
          />
          <span className="mt-1 block text-right text-xs text-ink-soft">
            {title.length}/{MAX_TITLE_LENGTH}
          </span>
        </label>

        <label className="block">
          <span className="label">Nội dung</span>
          <textarea
            className="input min-h-64 resize-y"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            required
            placeholder="Nhập nội dung bài đăng"
          />
          <span className="mt-1 block text-right text-xs text-ink-soft">
            {content.length}/{MAX_CONTENT_LENGTH}
          </span>
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <Link to="/admin/posts" className="btn-outline">
            Hủy
          </Link>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy
              ? "Đang lưu..."
              : editing
                ? "Lưu thay đổi"
                : "Đăng bài"}
          </button>
        </div>
      </form>
    </div>
  );
}

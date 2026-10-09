import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { PostInteractions as PostInteractionsData } from "../types";
import { formatDate } from "../utils/format";
import { Spinner } from "./States";

const REACTIONS = [
  { value: "LIKE", emoji: "👍", label: "Thích" },
  { value: "LOVE", emoji: "❤️", label: "Yêu thích" },
  { value: "HAHA", emoji: "😂", label: "Haha" },
  { value: "WOW", emoji: "😮", label: "Wow" },
  { value: "SAD", emoji: "😢", label: "Buồn" },
  { value: "ANGRY", emoji: "😡", label: "Phẫn nộ" },
] as const;

export default function PostInteractions({
  postId,
  moderator = false,
}: {
  postId: number;
  moderator?: boolean;
}) {
  const { data, loading, error, reload, setData } = useAsync(
    () => api.postInteractions(postId),
    [postId],
  );
  const [comment, setComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null,
  );
  const [commentToDeleteId, setCommentToDeleteId] = useState<number | null>(
    null,
  );

  async function react(reaction: string) {
    setBusy(true);
    try {
      const updated = await api.setPostReaction(
        postId,
        data?.myReaction === reaction ? null : reaction,
      );
      setData(updated);
      setReactionMenuOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;
    if (content.length > 1000) {
      toast.error("Bình luận không được vượt quá 1.000 ký tự.");
      return;
    }

    setBusy(true);
    try {
      await api.addPostComment(postId, content);
      setComment("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCommentId === null) return;
    const content = editingContent.trim();
    if (!content) {
      toast.error("Bình luận không được để trống.");
      return;
    }
    if (content.length > 1000) {
      toast.error("Bình luận không được vượt quá 1.000 ký tự.");
      return;
    }

    setBusy(true);
    try {
      await api.editPostComment(editingCommentId, content);
      setEditingCommentId(null);
      setEditingContent("");
      toast.success("Đã cập nhật bình luận");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: number) {
    setDeletingCommentId(commentId);
    try {
      if (moderator) {
        await api.deletePostComment(commentId);
      } else {
        await api.deleteGuestPostComment(commentId);
      }
      setCommentToDeleteId(null);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingContent("");
      }
      toast.success("Đã xóa bình luận");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingCommentId(null);
    }
  }

  const totalReactions = data
    ? Object.values(data.reactionCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <section className="border-t border-line px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="group relative flex items-center">
          <button
            type="button"
            title={data?.myReaction ? "Gỡ reaction" : "Thích"}
            aria-label={
              data?.myReaction
                ? `Bỏ ${REACTIONS.find((item) => item.value === data.myReaction)?.label ?? "reaction"}`
                : "Thích bài viết"
            }
            aria-pressed={Boolean(data?.myReaction)}
            disabled={moderator || busy || loading || Boolean(error)}
            onClick={() =>
              react(data?.myReaction ?? "LIKE")
            }
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
              data?.myReaction
                ? "border-pink-300 bg-pink-100 text-pink-700"
                : "border-line bg-white text-ink-soft hover:border-pink-200 hover:bg-pink-50"
            }`}
          >
            <span aria-hidden>
              {REACTIONS.find((item) => item.value === data?.myReaction)?.emoji ?? "👍"}
            </span>
            <span>
              {REACTIONS.find((item) => item.value === data?.myReaction)?.label ?? "Thích"}
            </span>
          </button>
          <button
            type="button"
            className="ml-1 grid h-9 w-8 place-items-center rounded-full text-xs text-ink-soft hover:bg-pink-50 sm:hidden"
            aria-label="Chọn cảm xúc"
            aria-expanded={reactionMenuOpen}
            onClick={() => setReactionMenuOpen((open) => !open)}
          >
            ▴
          </button>
          {!moderator && (
            <div
              className="absolute bottom-full left-0 z-10 pb-2"
            >
              <div
                className={`flex origin-bottom-left items-center gap-1 rounded-full border border-line bg-white p-1.5 shadow-lift transition duration-150 ${
                  reactionMenuOpen
                    ? "visible scale-100 opacity-100"
                    : "invisible scale-95 opacity-0 group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100"
                }`}
                role="group"
                aria-label="Chọn reaction"
              >
                {REACTIONS.map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    title={`${label} (${data?.reactionCounts[value] ?? 0})`}
                    aria-label={`${label}, ${data?.reactionCounts[value] ?? 0}`}
                    aria-pressed={data?.myReaction === value}
                    disabled={busy || loading || Boolean(error)}
                    onClick={() => react(value)}
                    className={`grid h-10 w-10 place-items-center rounded-full text-2xl transition hover:-translate-y-1 hover:scale-125 ${
                      data?.myReaction === value ? "bg-pink-100" : "hover:bg-pink-50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="ml-auto text-xs text-ink-soft">
          {totalReactions} lượt reaction · {data?.commentCount ?? 0} bình luận
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <Spinner label="Đang tải bình luận" />
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            Không thể tải tương tác: {error}
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={reload}
            >
              Thử lại
            </button>
          </div>
        ) : (
          data?.comments.map((item) => (
            <article
              key={item.id}
              className="flex items-start gap-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-bold text-pink-700">
                K
              </span>
              <div className="min-w-0 flex-1 rounded-2xl bg-pink-50 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-bold">{item.author}</p>
                  <time
                    dateTime={item.createdAt}
                    className="text-[11px] text-ink-soft"
                  >
                    {formatDate(item.createdAt)}
                    {item.editedAt && " · đã chỉnh sửa"}
                  </time>
                </div>
                {editingCommentId === item.id ? (
                  <form onSubmit={submitEdit} className="mt-2 space-y-2">
                    <label className="sr-only" htmlFor={`edit-comment-${item.id}`}>
                      Chỉnh sửa bình luận
                    </label>
                    <textarea
                      id={`edit-comment-${item.id}`}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      className="input !rounded-xl"
                      disabled={busy}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-outline !min-h-9 !px-3 !py-1"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingContent("");
                        }}
                        disabled={busy}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="btn-primary !min-h-9 !px-3 !py-1"
                        disabled={busy || !editingContent.trim()}
                      >
                        {busy ? "Đang lưu..." : "Lưu"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-1 whitespace-pre-line break-words text-sm">
                    {item.content}
                  </p>
                )}
              </div>
              {moderator ? (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  disabled={deletingCommentId === item.id || editingCommentId === item.id}
                  onClick={() => setCommentToDeleteId(item.id)}
                >
                  Xóa
                </button>
              ) : item.canEdit && editingCommentId !== item.id ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-pink-700 hover:bg-pink-50"
                    onClick={() => {
                      setEditingCommentId(item.id);
                      setEditingContent(item.content);
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    onClick={() => setCommentToDeleteId(item.id)}
                  >
                    Xóa
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {!moderator && (
        <form onSubmit={submitComment} className="mt-4 flex items-end gap-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-bold text-pink-700"
            aria-label="Bạn sẽ bình luận với tên Khách"
            title="Bạn sẽ bình luận với tên Khách"
          >
            K
          </span>
          <label className="sr-only" htmlFor={`comment-${postId}`}>
            Viết bình luận với tên Khách
          </label>
          <textarea
            id={`comment-${postId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={1}
            placeholder="Viết bình luận với tên Khách..."
            className="input min-h-10 flex-1 resize-y !rounded-2xl !py-2"
            disabled={busy}
          />
          <button
            type="submit"
            className="btn-primary !min-h-10 !px-4 !py-2"
            disabled={busy || !comment.trim()}
          >
            Gửi
          </button>
        </form>
      )}
      {!moderator && (
        <p className="mt-2 text-xs text-ink-soft">
          Bình luận hiển thị công khai với tên “Khách”. Quyền sửa/xóa được lưu
          trên trình duyệt này.
        </p>
      )}
      <ConfirmDialog
        open={commentToDeleteId !== null}
        title="Xóa bình luận này?"
        confirmLabel="Xóa bình luận"
        danger
        busy={deletingCommentId !== null}
        onConfirm={() => {
          if (commentToDeleteId !== null) {
            void deleteComment(commentToDeleteId);
          }
        }}
        onCancel={() => setCommentToDeleteId(null)}
      >
        {moderator
          ? "Bình luận sẽ bị xóa vĩnh viễn."
          : "Bạn chỉ có thể xóa bình luận này từ trình duyệt đã đăng bình luận."}
      </ConfirmDialog>
    </section>
  );
}

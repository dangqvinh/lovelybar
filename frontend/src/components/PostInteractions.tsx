import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import PostImageGallery from "./PostImageGallery";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
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
  const [commentAuthor, setCommentAuthor] = useState(() =>
    api.getCommentAuthor(),
  );
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [ownedCommentIds, setOwnedCommentIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [commentReactionMenuId, setCommentReactionMenuId] = useState<number | null>(
    null,
  );
  const reactionPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const postReactionRef = useRef<HTMLDivElement>(null);
  const commentReactionRefs = useRef(new Map<number, HTMLDivElement>());
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null,
  );
  const [commentToDeleteId, setCommentToDeleteId] = useState<number | null>(
    null,
  );
  const [realtimeAttempt, setRealtimeAttempt] = useState(0);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const commentPreviews = useMemo(
    () => commentFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [commentFiles],
  );
  const replyPreviews = useMemo(
    () => replyFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [replyFiles],
  );

  useEffect(
    () => () => commentPreviews.forEach(({ url }) => URL.revokeObjectURL(url)),
    [commentPreviews],
  );
  useEffect(
    () => () => replyPreviews.forEach(({ url }) => URL.revokeObjectURL(url)),
    [replyPreviews],
  );

  useEffect(() => {
    if (!reactionMenuOpen && commentReactionMenuId === null) return;

    function dismissReactionMenus(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (reactionMenuOpen && !postReactionRef.current?.contains(target)) {
        setReactionMenuOpen(false);
      }
      if (
        commentReactionMenuId !== null &&
        !commentReactionRefs.current.get(commentReactionMenuId)?.contains(target)
      ) {
        setCommentReactionMenuId(null);
      }
    }

    document.addEventListener("pointerdown", dismissReactionMenus);
    return () => document.removeEventListener("pointerdown", dismissReactionMenus);
  }, [reactionMenuOpen, commentReactionMenuId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    const channel = supabase
      .channel(`post-comments:${postId}`, { config: { private: false } })
      .on("broadcast", { event: "comment_changed" }, () => {
        reload();
      })
      .subscribe((status, error) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setRealtimeError(null);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeError(error?.message ?? status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [postId, realtimeAttempt, reload]);

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

  function startReactionHold(onHold: () => void) {
    if (reactionPressTimer.current !== null) {
      window.clearTimeout(reactionPressTimer.current);
    }
    longPressTriggered.current = false;
    reactionPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onHold();
    }, 500);
  }

  function endReactionHold() {
    if (reactionPressTimer.current !== null) {
      window.clearTimeout(reactionPressTimer.current);
      reactionPressTimer.current = null;
    }
  }

  function selectImages(files: FileList | null, isReply: boolean) {
    const selected = Array.from(files ?? []);
    const currentFiles = isReply ? replyFiles : commentFiles;
    if (currentFiles.length + selected.length > 5) {
      toast.error("Mỗi bình luận chỉ được đính kèm tối đa 5 ảnh.");
      return;
    }
    const invalidFile = selected.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024,
    );
    if (invalidFile) {
      toast.error("Ảnh phải là JPG, PNG hoặc WEBP và có dung lượng tối đa 2 MB.");
      return;
    }
    if (isReply) setReplyFiles((current) => [...current, ...selected]);
    else setCommentFiles((current) => [...current, ...selected]);
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    parentId: number | null = null,
  ) {
    event.preventDefault();
    const content = (parentId === null ? comment : replyContent).trim();
    const files = parentId === null ? commentFiles : replyFiles;
    const author = moderator ? "Admin" : commentAuthor.trim();
    if (!content) {
      toast.error("Vui lòng nhập nội dung bình luận.");
      return;
    }
    if (!moderator && (!author || author.length > 40 || author.toLowerCase() === "admin")) {
      toast.error("Vui lòng nhập tên từ 1 đến 40 ký tự; không thể dùng tên Admin.");
      return;
    }
    if (content.length > 1000) {
      toast.error("Bình luận không được vượt quá 1.000 ký tự.");
      return;
    }

    setBusy(true);
    try {
      const createdComment = moderator
        ? await api.addAdminPostComment(postId, content, parentId, files)
        : await api.addPostComment(postId, content, parentId, files, author);
      if (!moderator && !api.getCommentAuthor()) {
        api.saveCommentAuthor(author);
      }
      if (parentId === null) {
        setComment("");
        setCommentFiles([]);
      } else {
        setReplyContent("");
        setReplyFiles([]);
        setReplyingToId(null);
      }
      if (!moderator) {
        setOwnedCommentIds((current) => new Set(current).add(createdComment.id));
      }
      setData((current) => {
        if (!current) return current;
        const alreadyLoaded = current.comments.some(
          (item) => item.id === createdComment.id,
        );
        return {
          ...current,
          comments: [
            createdComment,
            ...current.comments.filter((item) => item.id !== createdComment.id),
          ],
          commentCount: current.commentCount + (alreadyLoaded ? 0 : 1),
        };
      });
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
      setOwnedCommentIds((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
      setCommentToDeleteId(null);
      if (replyingToId === commentId) setReplyingToId(null);
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

  async function reactToComment(commentId: number, reaction: string) {
    const target = comments.find((item) => item.id === commentId);
    if (!target) return;
    setBusy(true);
    try {
      const updated = await api.setPostCommentReaction(
        commentId,
        target.myReaction === reaction ? null : reaction,
      );
      setData(updated);
      setCommentReactionMenuId(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalReactions = data
    ? Object.values(data.reactionCounts).reduce((sum, count) => sum + count, 0)
    : 0;
  const comments = data?.comments ?? [];

  function renderComment(item: (typeof comments)[number], depth = 0) {
    const sortByReactions = (list: typeof comments) =>
      [...list].sort((a, b) => {
        const aTotal = Object.values(a.reactionCounts).reduce((sum, count) => sum + count, 0);
        const bTotal = Object.values(b.reactionCounts).reduce((sum, count) => sum + count, 0);
        return bTotal - aTotal || b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
      });
    const replies = sortByReactions(
      comments.filter((candidate) => candidate.parentId === item.id),
    );
    const canEdit =
      !moderator &&
      (ownedCommentIds.has(item.id) ||
        item.canEdit ||
        api.canEditPostComment(item.id));

    return (
      <div
        key={item.id}
        className={depth > 0 ? "ml-3 min-w-0 border-l-2 border-pink-100 pl-2 sm:ml-5 sm:pl-3" : "min-w-0"}
      >
        <article className="flex items-start gap-2">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
            item.author === "Admin"
              ? "bg-ink text-white"
              : "bg-pink-100 text-pink-700"
          }`}>
            {item.author === "Admin" ? "A" : "K"}
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
            {item.images.length > 0 && (
              <div className="mt-2 max-w-lg">
                <PostImageGallery
                  images={item.images}
                  title={`Bình luận của ${item.author}`}
                />
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div
                ref={(element) => {
                  if (element) commentReactionRefs.current.set(item.id, element);
                  else commentReactionRefs.current.delete(item.id);
                }}
                className="group/comment-reaction inline-flex flex-col items-start"
              >
                <button
                  type="button"
                  title={item.myReaction ? "Gỡ reaction" : "Thích"}
                  aria-label={
                    item.myReaction
                      ? `Bỏ ${REACTIONS.find((reaction) => reaction.value === item.myReaction)?.label ?? "reaction"}`
                      : "Thích bình luận"
                  }
                  aria-pressed={Boolean(item.myReaction)}
                  disabled={busy}
                  onPointerDown={() =>
                    startReactionHold(() => setCommentReactionMenuId(item.id))
                  }
                  onPointerUp={endReactionHold}
                  onPointerCancel={endReactionHold}
                  onPointerLeave={endReactionHold}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={() => {
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    void reactToComment(item.id, item.myReaction ?? "LIKE");
                  }}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
                    item.myReaction
                      ? "border-pink-300 bg-pink-100 text-pink-700"
                      : "border-transparent text-ink-soft hover:border-line hover:bg-white"
                  }`}
                >
                  <span aria-hidden>
                    {REACTIONS.find((reaction) => reaction.value === item.myReaction)?.emoji ?? "👍"}
                  </span>
                  <span>
                    {REACTIONS.find((reaction) => reaction.value === item.myReaction)?.label ?? "Thích"}
                  </span>
                </button>
                <div
                  className={`grid w-full grid-rows-[0fr] transition-[grid-template-rows] duration-150 [@media(hover:hover)]:group-hover/comment-reaction:grid-rows-[1fr] [@media(hover:hover)]:group-focus-within/comment-reaction:grid-rows-[1fr] ${
                    commentReactionMenuId === item.id ? "grid-rows-[1fr]" : ""
                  }`}
                >
                  <div
                    className={`min-h-0 overflow-hidden ${
                      commentReactionMenuId === item.id
                        ? "visible opacity-100"
                        : "invisible opacity-0 [@media(hover:hover)]:group-hover/comment-reaction:visible [@media(hover:hover)]:group-hover/comment-reaction:opacity-100 [@media(hover:hover)]:group-focus-within/comment-reaction:visible [@media(hover:hover)]:group-focus-within/comment-reaction:opacity-100"
                    }`}
                  >
                    <div
                      className="mt-2 flex items-center gap-1 rounded-full border border-line bg-white p-1.5 shadow-lift"
                      role="group"
                      aria-label="Chọn reaction cho bình luận"
                    >
                      {REACTIONS.map(({ value, emoji, label }) => (
                        <button
                          key={value}
                          type="button"
                          title={`${label} (${item.reactionCounts[value] ?? 0})`}
                          aria-label={`${label}, ${item.reactionCounts[value] ?? 0}`}
                          aria-pressed={item.myReaction === value}
                          disabled={busy}
                          onClick={() => {
                            longPressTriggered.current = false;
                            void reactToComment(item.id, value);
                          }}
                          className={`grid h-9 w-9 place-items-center rounded-full text-xl transition hover:-translate-y-1 hover:scale-125 ${
                            item.myReaction === value ? "bg-pink-100" : "hover:bg-pink-50"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {Object.entries(item.reactionCounts)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([reaction, count]) => (
                  <span key={reaction} className="text-xs text-ink-soft">
                    {REACTIONS.find((option) => option.value === reaction)?.emoji ?? ""} {count}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1">
            {!moderator && canEdit && editingCommentId !== item.id && (
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
            )}
            {(moderator || canEdit) && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                disabled={deletingCommentId === item.id || editingCommentId === item.id}
                onClick={() => setCommentToDeleteId(item.id)}
              >
                Xóa
              </button>
            )}
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-pink-50"
              disabled={busy}
              onClick={() => {
                setReplyingToId((current) => current === item.id ? null : item.id);
                setReplyContent("");
                setReplyFiles([]);
              }}
            >
              Trả lời
            </button>
          </div>
        </article>
        {replyingToId === item.id && (
          <form
            onSubmit={(event) => submitComment(event, item.id)}
            className="ml-10 mt-2 space-y-2 sm:ml-12"
          >
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={`Trả lời ${item.author}...`}
              aria-label={`Trả lời bình luận của ${item.author}`}
              className="input w-full !rounded-xl"
              disabled={busy}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="btn-outline inline-flex min-h-9 cursor-pointer items-center !px-3 !py-1">
                  Thêm ảnh
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      selectImages(event.currentTarget.files, true);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <span className="ml-2 text-xs text-ink-soft">
                  {replyFiles.length}/5 ảnh
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-outline !min-h-9 !px-3 !py-1"
                  onClick={() => {
                    setReplyingToId(null);
                    setReplyFiles([]);
                    setReplyContent("");
                  }}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary !min-h-9 !px-3 !py-1"
                  disabled={busy || !replyContent.trim()}
                >
                  {busy ? "Đang gửi..." : "Trả lời"}
                </button>
              </div>
            </div>
            {replyPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replyPreviews.map(({ file, url }, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg">
                    <img src={url} alt={`Ảnh xem trước ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Xóa ảnh ${file.name}`}
                      onClick={() => setReplyFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-sm font-bold text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
        )}
        {replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="w-full min-w-0 border-t border-line px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <div ref={postReactionRef} className="group flex flex-col items-start">
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
            onPointerDown={() =>
              startReactionHold(() => setReactionMenuOpen(true))
            }
            onPointerUp={endReactionHold}
            onPointerCancel={endReactionHold}
            onPointerLeave={endReactionHold}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
              }
              void react(data?.myReaction ?? "LIKE");
            }}
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
          {!moderator && (
            <div
              className={`grid w-full grid-rows-[0fr] transition-[grid-template-rows] duration-150 [@media(hover:hover)]:group-hover:grid-rows-[1fr] [@media(hover:hover)]:group-focus-within:grid-rows-[1fr] ${
                reactionMenuOpen ? "grid-rows-[1fr]" : ""
              }`}
            >
              <div
                className={`min-h-0 overflow-hidden ${
                  reactionMenuOpen
                    ? "visible opacity-100"
                    : "invisible opacity-0 [@media(hover:hover)]:group-hover:visible [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:visible [@media(hover:hover)]:group-focus-within:opacity-100"
                }`}
              >
                <div
                  className="mt-2 flex items-center gap-1 rounded-full border border-line bg-white p-1.5 shadow-lift"
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
                      onClick={() => {
                        longPressTriggered.current = false;
                        void react(value);
                      }}
                      className={`grid h-10 w-10 place-items-center rounded-full text-2xl transition hover:-translate-y-1 hover:scale-125 ${
                        data?.myReaction === value ? "bg-pink-100" : "hover:bg-pink-50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <span className="ml-auto text-xs text-ink-soft">
          {totalReactions} lượt reaction · {data?.commentCount ?? 0} bình luận
        </span>
      </div>

      <div
        className={`mt-4 space-y-3 ${
          (data?.commentCount ?? 0) > 10
            ? "max-h-[70vh] overflow-y-auto overscroll-contain pr-2"
            : ""
        }`}
      >
        {loading && !data ? (
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
          [...comments]
            .filter((item) => item.parentId === null)
            .sort((a, b) => {
              const aTotal = Object.values(a.reactionCounts).reduce((sum, count) => sum + count, 0);
              const bTotal = Object.values(b.reactionCounts).reduce((sum, count) => sum + count, 0);
              return bTotal - aTotal || b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
            })
            .map((item) => renderComment(item))
        )}
      </div>

      <form
        onSubmit={(event) => submitComment(event)}
        className="mt-4 space-y-2"
      >
        {!moderator && !api.getCommentAuthor() && (
          <div className="pl-11">
            <label htmlFor={`comment-author-${postId}`} className="mb-1 block text-xs font-semibold">
              Tên hiển thị cho các bình luận trong phiên này
            </label>
            <input
              id={`comment-author-${postId}`}
              value={commentAuthor}
              onChange={(event) => setCommentAuthor(event.target.value)}
              maxLength={40}
              autoComplete="name"
              className="input !min-h-10 !rounded-xl"
              placeholder="Nhập tên của bạn"
              disabled={busy}
              required
            />
          </div>
        )}
        <div className="flex items-end gap-2">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
              moderator ? "bg-ink text-white" : "bg-pink-100 text-pink-700"
            }`}
            aria-label={moderator ? "Bạn sẽ bình luận với tên Admin" : "Bạn sẽ bình luận với tên Khách"}
            title={moderator ? "Bạn sẽ bình luận với tên Admin" : "Bạn sẽ bình luận với tên Khách"}
          >
            {moderator ? "A" : "K"}
          </span>
          <label className="sr-only" htmlFor={`comment-${postId}`}>
            {moderator ? "Viết bình luận với tên Admin" : "Viết bình luận với tên Khách"}
          </label>
          <textarea
            id={`comment-${postId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={1}
            placeholder={moderator ? "Viết bình luận với tên Admin..." : "Viết bình luận với tên Khách..."}
            className="input min-h-10 flex-1 resize-y !rounded-2xl !py-2"
            disabled={busy}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
          <div>
            <label className="btn-outline inline-flex min-h-9 cursor-pointer items-center !px-3 !py-1">
              Thêm ảnh
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  selectImages(event.currentTarget.files, false);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <span className="ml-2 text-xs text-ink-soft">
              {commentFiles.length}/5 ảnh · JPG/PNG/WEBP, tối đa 2 MB/ảnh
            </span>
          </div>
          <button
            type="submit"
            className="btn-primary !min-h-10 !px-4 !py-2"
            disabled={busy || !comment.trim()}
          >
            {busy ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
        {commentPreviews.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {commentPreviews.map(({ file, url }, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg">
                <img src={url} alt={`Ảnh xem trước ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Xóa ảnh ${file.name}`}
                  onClick={() => setCommentFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-sm font-bold text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
      {!moderator && (
        <p className="mt-2 text-xs text-ink-soft">
          Tên hiển thị công khai trong phiên trình duyệt này. Quyền sửa/xóa được
          lưu trên trình duyệt đã đăng bình luận.
        </p>
      )}
      {realtimeError && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-red-700" role="status">
          Cập nhật bình luận trực tiếp bị gián đoạn ({realtimeError}).
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setRealtimeError(null);
              setRealtimeAttempt((attempt) => attempt + 1);
              reload();
            }}
          >
            Kết nối lại
          </button>
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

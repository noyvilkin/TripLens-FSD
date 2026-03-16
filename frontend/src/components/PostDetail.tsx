import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toggleLike, addComment } from '../api/postApi';
import { useAuth } from '../hooks/useAuth';
import { decodeToken } from '../utils/jwt';
import type { Post, PostAuthor, PostComment } from '../types/user';
import styles from './PostDetail.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const DEFAULT_AVATAR = '/user.png';

interface PostDetailProps {
  post: Post;
  onClose: () => void;
  onPostUpdate: (updated: Post) => void;
}

const getAuthor = (userId: string | PostAuthor): PostAuthor | null => {
  if (typeof userId === 'object' && userId !== null) return userId;
  return null;
};

const getAvatarUrl = (author: PostAuthor | null): string => {
  if (!author?.profilePic || author.profilePic.startsWith('data:')) return DEFAULT_AVATAR;
  return `${API_URL}${author.profilePic}`;
};

const formatTimestamp = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const PostDetail: React.FC<PostDetailProps> = ({ post, onClose, onPostUpdate }) => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const currentUserId = accessToken ? decodeToken(accessToken)?.userId : null;

  const [imageIndex, setImageIndex] = useState(0);
  const [likes, setLikes] = useState<string[]>(post.likes || []);
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isLiked = currentUserId ? likes.includes(currentUserId) : false;
  const author = getAuthor(post.userId);

  useEffect(() => {
    setLikes(post.likes || []);
    setComments(post.comments || []);
  }, [post]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleToggleLike = async () => {
    if (!currentUserId) return;

    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 400);

    const prevLikes = [...likes];
    if (isLiked) {
      setLikes(likes.filter(id => id !== currentUserId));
    } else {
      setLikes([...likes, currentUserId]);
    }

    try {
      const updated = await toggleLike(post._id);
      setLikes(updated.likes || []);
      onPostUpdate({ ...post, likes: updated.likes, comments: updated.comments });
    } catch {
      setLikes(prevLikes);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const updated = await addComment(post._id, commentText.trim());
      setComments(updated.comments || []);
      setCommentText('');
      onPostUpdate({ ...post, likes: updated.likes, comments: updated.comments });
    } catch {
      // Keep the text so user can retry
    } finally {
      setSubmittingComment(false);
    }
  };

  const goToProfile = (e: React.MouseEvent, profileAuthor: PostAuthor | null) => {
    e.stopPropagation();
    if (profileAuthor) {
      onClose();
      navigate(`/profile/${profileAuthor._id}`);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} type="button">&times;</button>

        {/* Image Gallery */}
        {post.images.length > 0 && (
          <div className={styles.gallery}>
            {post.images.length > 1 && (
              <button
                className={`${styles.galleryBtn} ${styles.galleryPrev}`}
                onClick={() => setImageIndex(i => i === 0 ? post.images.length - 1 : i - 1)}
                type="button"
              >&#8249;</button>
            )}
            <img
              src={`${API_URL}${post.images[imageIndex]}`}
              alt={post.title}
              className={styles.galleryImage}
            />
            {post.images.length > 1 && (
              <button
                className={`${styles.galleryBtn} ${styles.galleryNext}`}
                onClick={() => setImageIndex(i => i === post.images.length - 1 ? 0 : i + 1)}
                type="button"
              >&#8250;</button>
            )}
            {post.images.length > 1 && (
              <div className={styles.dots}>
                {post.images.map((_, i) => (
                  <span
                    key={i}
                    className={`${styles.dot} ${i === imageIndex ? styles.dotActive : ''}`}
                    onClick={() => setImageIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className={styles.content}>
          {/* Author Row */}
          <div className={styles.authorRow}>
            <button
              className={styles.authorLink}
              onClick={e => goToProfile(e, author)}
              type="button"
            >
              <img
                src={getAvatarUrl(author)}
                alt={author?.username || 'User'}
                className={styles.avatar}
                onError={e => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
              />
              <span className={styles.authorName}>{author?.username || 'Unknown'}</span>
            </button>
            {post.createdAt && (
              <span className={styles.date}>
                {new Date(post.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            )}
          </div>

          <h2 className={styles.title}>{post.title}</h2>
          <p className={styles.text}>{post.content}</p>

          {post.images.length > 1 && (
            <p className={styles.photoCount}>{post.images.length} photos</p>
          )}

          {/* Like Bar */}
          <div className={styles.likeBar}>
            <button
              className={`${styles.likeBtn} ${isLiked ? styles.liked : ''} ${isLikeAnimating ? styles.likeAnimate : ''}`}
              onClick={handleToggleLike}
              type="button"
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <svg viewBox="0 0 24 24" className={styles.heartIcon}>
                <path
                  d={isLiked
                    ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    : "M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"
                  }
                />
              </svg>
            </button>
            <span className={styles.likeCount}>
              {likes.length} {likes.length === 1 ? 'like' : 'likes'}
            </span>
          </div>

          {/* Comments Section */}
          <div className={styles.commentsSection}>
            <h3 className={styles.commentsTitle}>
              Comments ({comments.length})
            </h3>

            <div className={styles.commentsList}>
              {comments.length === 0 && (
                <p className={styles.noComments}>No comments yet. Be the first!</p>
              )}
              {comments.map((comment, idx) => (
                <div key={`${comment.userId}-${comment.createdAt}-${idx}`} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{comment.username}</span>
                    <span className={styles.commentTime}>{formatTimestamp(comment.createdAt)}</span>
                  </div>
                  <p className={styles.commentText}>{comment.text}</p>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment Input */}
            <form onSubmit={handleAddComment} className={styles.commentForm}>
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className={styles.commentInput}
                maxLength={500}
                disabled={submittingComment}
              />
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? '...' : 'Post'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;

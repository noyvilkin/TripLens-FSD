import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts } from '../api/postApi';
import type { Post, PostAuthor } from '../types/user';
import styles from './TripFeed.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFAULT_AVATAR = '/user.png';

const getAuthor = (userId: string | PostAuthor): PostAuthor | null => {
  if (typeof userId === 'object' && userId !== null) return userId;
  return null;
};

const getAvatarUrl = (author: PostAuthor | null): string => {
  if (!author?.profilePic || author.profilePic.startsWith('data:')) return DEFAULT_AVATAR;
  return `${API_URL}${author.profilePic}`;
};

const TripFeed: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState<Record<string, number>>({});

  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPage((prev) => prev + 1);
          }
        },
        { threshold: 0.1 }
      );

      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPosts(page, 10, controller.signal);
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p._id));
          const newPosts = data.posts.filter((p) => !existingIds.has(p._id));
          return [...prev, ...newPosts];
        });
        setHasMore(page < data.totalPages);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ERR_CANCELED') return;
        setError('Failed to load posts. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
    return () => controller.abort();
  }, [page]);

  const getImageIndex = (postId: string) => activeImageIndex[postId] || 0;

  const nextImage = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => ({
      ...prev,
      [post._id]: ((prev[post._id] || 0) + 1) % post.images.length,
    }));
  };

  const prevImage = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => ({
      ...prev,
      [post._id]: ((prev[post._id] || 0) - 1 + post.images.length) % post.images.length,
    }));
  };

  const openPost = (post: Post) => {
    setSelectedPost(post);
    setModalImageIndex(0);
  };

  const closePost = () => {
    setSelectedPost(null);
  };

  const goToProfile = (e: React.MouseEvent, author: PostAuthor | null) => {
    e.stopPropagation();
    if (author) navigate(`/profile/${author._id}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Trip Feed</h1>
        <p className={styles.subtitle}>
          Explore the latest travel stories shared by the community.
        </p>
      </div>

      <div className={styles.feed}>
        {posts.map((post, index) => {
          const isLast = index === posts.length - 1;
          const imgIdx = getImageIndex(post._id);
          const author = getAuthor(post.userId);

          return (
            <div
              ref={isLast ? lastPostRef : undefined}
              key={post._id}
              className={styles.card}
              onClick={() => openPost(post)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') openPost(post); }}
            >
              {/* Author row */}
              <div className={styles.authorRow}>
                <button
                  className={styles.authorLink}
                  onClick={(e) => goToProfile(e, author)}
                  type="button"
                >
                  <img
                    src={getAvatarUrl(author)}
                    alt={author?.username || 'User'}
                    className={styles.avatar}
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                  />
                  <span className={styles.authorName}>{author?.username || 'Unknown'}</span>
                </button>
                {post.createdAt && (
                  <span className={styles.cardDate}>
                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {/* Image carousel */}
              {post.images.length > 0 && (
                <div className={styles.imageContainer}>
                  <img
                    src={`${API_URL}${post.images[imgIdx]}`}
                    alt={post.title}
                    className={styles.image}
                  />
                  {post.images.length > 1 && (
                    <>
                      <button
                        className={`${styles.carouselBtn} ${styles.carouselPrev}`}
                        onClick={(e) => prevImage(e, post)}
                        type="button"
                        aria-label="Previous image"
                      >
                        &#8249;
                      </button>
                      <button
                        className={`${styles.carouselBtn} ${styles.carouselNext}`}
                        onClick={(e) => nextImage(e, post)}
                        type="button"
                        aria-label="Next image"
                      >
                        &#8250;
                      </button>
                      <div className={styles.dots}>
                        {post.images.map((_, i) => (
                          <span
                            key={i}
                            className={`${styles.dot} ${i === imgIdx ? styles.dotActive : ''}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Card body */}
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{post.title}</h2>
                <p className={styles.cardContent}>
                  {post.content.length <= 180
                    ? post.content
                    : `${post.content.slice(0, 180)}...`}
                </p>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className={styles.loader}>
            <div className={styles.spinner} />
            <p>Loading trips...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorCard}>
            <p>{error}</p>
            <button onClick={() => setPage((p) => p)} className={styles.retryBtn}>
              Retry
            </button>
          </div>
        )}

        {!loading && !hasMore && posts.length > 0 && (
          <p className={styles.endMessage}>You've seen all trips!</p>
        )}

        {!loading && posts.length === 0 && !error && (
          <div className={styles.emptyState}>
            <p>No trips yet. Be the first to share your adventure!</p>
          </div>
        )}
      </div>

      {/* ========== Post Detail Modal ========== */}
      {selectedPost && (() => {
        const author = getAuthor(selectedPost.userId);
        return (
          <div className={styles.modalOverlay} onClick={closePost}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} onClick={closePost} type="button">
                &times;
              </button>

              {/* Modal image carousel */}
              {selectedPost.images.length > 0 && (
                <div className={styles.modalImageWrap}>
                  {selectedPost.images.length > 1 && (
                    <button
                      className={`${styles.modalCarouselBtn} ${styles.modalCarouselPrev}`}
                      onClick={() =>
                        setModalImageIndex((i) =>
                          i === 0 ? selectedPost.images.length - 1 : i - 1
                        )
                      }
                      type="button"
                    >
                      &#8249;
                    </button>
                  )}
                  <img
                    src={`${API_URL}${selectedPost.images[modalImageIndex]}`}
                    alt={selectedPost.title}
                    className={styles.modalImage}
                  />
                  {selectedPost.images.length > 1 && (
                    <button
                      className={`${styles.modalCarouselBtn} ${styles.modalCarouselNext}`}
                      onClick={() =>
                        setModalImageIndex((i) =>
                          i === selectedPost.images.length - 1 ? 0 : i + 1
                        )
                      }
                      type="button"
                    >
                      &#8250;
                    </button>
                  )}
                  {selectedPost.images.length > 1 && (
                    <div className={styles.modalDots}>
                      {selectedPost.images.map((_, i) => (
                        <span
                          key={i}
                          className={`${styles.dot} ${i === modalImageIndex ? styles.dotActive : ''}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal content */}
              <div className={styles.modalBody}>
                <div className={styles.modalAuthorRow}>
                  <button
                    className={styles.authorLink}
                    onClick={(e) => { closePost(); goToProfile(e, author); }}
                    type="button"
                  >
                    <img
                      src={getAvatarUrl(author)}
                      alt={author?.username || 'User'}
                      className={styles.avatar}
                      onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                    />
                    <span className={styles.authorName}>{author?.username || 'Unknown'}</span>
                  </button>
                  {selectedPost.createdAt && (
                    <span className={styles.modalDate}>
                      {new Date(selectedPost.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <h2 className={styles.modalTitle}>{selectedPost.title}</h2>
                <p className={styles.modalText}>{selectedPost.content}</p>

                {selectedPost.images.length > 1 && (
                  <p className={styles.imageCount}>
                    {selectedPost.images.length} photos
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TripFeed;

import React, { useState } from "react";
import SmartSearchBar from "./SmartSearchBar";
import ResultsDisplay from "./ResultsDisplay";
import PostDetail from "./PostDetail";
import { smartSearch } from "../api/searchApi";
import { getUserProfile } from "../api/userApi";
import type { SmartSearchResponse } from "../types/search";
import type { Post, PostAuthor } from "../types/user";
import styles from "./DiscoverPage.module.css";

const DiscoverPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SmartSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const buildPostFromTrip = (
    trip: SmartSearchResponse["sources"][number],
    author?: PostAuthor
  ): Post => ({
      _id: trip._id,
      title: trip.title,
      content: trip.content,
      images: trip.images || [],
      userId: author || trip.userId,
      likes: trip.likes || [],
      comments: trip.comments || [],
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
    });

  const openSourceTrip = async (trip: SmartSearchResponse["sources"][number]) => {
    const sourceUserId = trip.userId;

    setSelectedPost(buildPostFromTrip(trip));

    if (!sourceUserId) return;

    try {
      const profile = await getUserProfile(sourceUserId);
      setSelectedPost((prev) => {
        if (!prev || prev._id !== trip._id) return prev;
        return {
          ...prev,
          userId: {
            _id: profile.id,
            username: profile.username,
            profilePic: profile.profilePic,
          },
        };
      });
    } catch {
      // Keep post open with fallback author if profile fetch fails
    }
  };

  const closePost = () => {
    setSelectedPost(null);
  };

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await smartSearch(query);
      setResult(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Search failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Discover Trips</h1>
        <p className={styles.subtitle}>
          Ask anything about travel destinations and get AI-powered insights
          from real trip experiences.
        </p>
        <SmartSearchBar onSearch={handleSearch} isLoading={isLoading} />
      </div>

      <div className={styles.content}>
        {error && (
          <div className={styles.errorCard}>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <ResultsDisplay
            answer={result.answer}
            sources={result.sources}
            onOpenTrip={openSourceTrip}
          />
        )}

        {!result && !error && !isLoading && (
          <div className={styles.emptyState}>
            <svg
              className={styles.emptyIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p>
              Try searching for &quot;Best beaches in Europe&quot; or &quot;Where
              can I hike in Israel?&quot;
            </p>
          </div>
        )}
      </div>

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={closePost}
          onPostUpdate={(updated) => {
            setSelectedPost((prev) => {
              if (!prev) return updated;
              const existingAuthor = typeof prev.userId === "object" ? prev.userId : null;
              const updatedUserId =
                typeof updated.userId === "string" && existingAuthor
                  ? existingAuthor
                  : updated.userId;
              return {
                ...updated,
                userId: updatedUserId,
              };
            });
            setResult((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                sources: prev.sources.map((source) =>
                  source._id === updated._id
                    ? {
                        ...source,
                        title: updated.title,
                        content: updated.content,
                        images: updated.images,
                        userId: typeof updated.userId === "string" ? updated.userId : updated.userId._id,
                        likes: updated.likes,
                        comments: updated.comments,
                        createdAt: updated.createdAt,
                        updatedAt: updated.updatedAt,
                      }
                    : source
                ),
              };
            });
          }}
        />
      )}
    </div>
  );
};

export default DiscoverPage;

import React, { useState } from "react";
import SmartSearchBar from "./SmartSearchBar";
import ResultsDisplay from "./ResultsDisplay";
import { smartSearch } from "../api/searchApi";
import type { SmartSearchResponse } from "../types/search";
import styles from "./DiscoverPage.module.css";

const DiscoverPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SmartSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <ResultsDisplay answer={result.answer} sources={result.sources} />
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
    </div>
  );
};

export default DiscoverPage;

import React, { useState } from "react";
import styles from "./SmartSearchBar.module.css";

interface SmartSearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed && !isLoading) {
      onSearch(trimmed);
    }
  };

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          className={styles.searchInput}
          placeholder='Ask anything about trips... e.g. "Where is it sunny in Israel?"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />

        <button
          type="submit"
          className={styles.searchButton}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : (
            "Search"
          )}
        </button>
      </div>
    </form>
  );
};

export default SmartSearchBar;

import React, { useEffect, useState } from "react";
import type { Trip } from "../types/search";
import styles from "./ResultsDisplay.module.css";

interface ResultsDisplayProps {
  answer: string;
  sources: Trip[];
}

const TYPEWRITER_SPEED = 12;

const useTypewriter = (text: string): string => {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;

    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) clearInterval(timer);
    }, TYPEWRITER_SPEED);

    return () => clearInterval(timer);
  }, [text]);

  return displayed;
};

const getImageUrl = (imagePath: string): string => {
  if (imagePath.startsWith("http")) return imagePath;
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${base}${imagePath}`;
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ answer, sources }) => {
  const typedAnswer = useTypewriter(answer);

  return (
    <div className={styles.results}>
      {/* AI Insight Section — glassmorphism card */}
      <section className={styles.insightCard}>
        <div className={styles.insightHeader}>
          <svg
            className={styles.sparkle}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
          </svg>
          <h2 className={styles.insightTitle}>AI Insight</h2>
        </div>
        <p className={styles.insightText}>
          {typedAnswer}
          <span className={styles.cursor}>|</span>
        </p>
      </section>

      {/* Source Trips Grid */}
      {sources.length > 0 && (
        <section className={styles.sourcesSection}>
          <h3 className={styles.sourcesTitle}>Source Trips</h3>
          <div className={styles.grid}>
            {sources.map((trip) => (
              <article key={trip._id} className={styles.tripCard}>
                {trip.images?.[0] && (
                  <div className={styles.imageWrapper}>
                    <img
                      src={getImageUrl(trip.images[0])}
                      alt={trip.title}
                      className={styles.tripImage}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className={styles.tripBody}>
                  <h4 className={styles.tripTitle}>{trip.title}</h4>
                  <p className={styles.tripContent}>
                    {trip.content.length > 160
                      ? `${trip.content.slice(0, 160)}...`
                      : trip.content}
                  </p>
                  {trip.createdAt && (
                    <time className={styles.tripDate}>
                      {new Date(trip.createdAt).toLocaleDateString()}
                    </time>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ResultsDisplay;

import styles from './LoadingScreen.module.css';

const LoadingScreen = () => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.logoContainer}>
          <div className={styles.logoText}>TL</div>
        </div>
        <h1>TripLens</h1>
        <p>Discovering your next adventure...</p>
        <div className={styles.spinnerContainer}>
          <div className={styles.spinner}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

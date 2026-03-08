import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { decodeToken } from '../utils/jwt';
import styles from './Navigation.module.css';

const Navigation: React.FC = () => {
  const { accessToken, logout } = useAuth();
  const userId = accessToken ? decodeToken(accessToken)?.userId : null;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          TripLens
        </Link>

        <div className={styles.links}>
          <Link to="/discover" className={styles.link}>
            Discover
          </Link>
          {userId && (
            <Link to={`/profile/${userId}`} className={styles.link}>
              My Profile
            </Link>
          )}
          <Link to="/post/new" className={styles.link}>
            Create Post
          </Link>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

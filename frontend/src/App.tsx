import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import ProfilePage from './components/ProfilePage';
import Navigation from './components/Navigation';
import PostCreatePage from './components/PostCreatePage';
import DiscoverPage from './components/DiscoverPage';

function App() {
  const { accessToken, loading } = useAuth();

  // While the AuthProvider is checking for a session, show a loading screen
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      {/* Show navigation only when logged in */}
      {accessToken && <Navigation />}
      
      <Routes>
        {/* 1. The Authentication Routes (Login/Register) */}
        {/* If user is already logged in, redirect them away from the auth pages */}
        <Route 
          path="/login" 
          element={!accessToken ? <AuthPage isLoginMode={true} /> : <Navigate to="/" />} 
        />

        <Route 
          path="/register" 
          element={!accessToken ? <AuthPage isLoginMode={false} /> : <Navigate to="/" />} 
        />

        {/* 2. Protected Routes (Only for logged-in users) */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          } 
        />

        {/* Discover / Smart Search Route */}
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          }
        />

        {/* Profile Page Route */}
        <Route 
          path="/profile/:userId" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />

        {/* Post Creation Route */}
        <Route
          path="/post/new"
          element={
            <ProtectedRoute>
              <PostCreatePage />
            </ProtectedRoute>
          }
        />

        {/* 3. Fallback: Redirect any unknown path to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import ProfilePage from './components/ProfilePage';
import Navigation from './components/Navigation';

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
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h1>Welcome to the Trip Feed!</h1>
                <p>Navigate to your profile using the navigation bar above.</p>
              </div>
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

        {/* 3. Fallback: Redirect any unknown path to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

import React, { useState, useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import { loginSchema, registerSchema } from '../types/auth';
import type { LoginFormData, RegisterFormData } from '../types/auth';
import styles from './AuthPage.module.css';
import { AxiosError } from 'axios';

interface AuthPageProps {
  isLoginMode: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ isLoginMode }) => {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    setIsLogin(isLoginMode);
  }, [isLoginMode]);



  const schema = isLogin ? loginSchema : registerSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur'
  });

  const onSubmit = async (data: LoginFormData | RegisterFormData) => {
    setServerError(null);
    setIsLoading(true);
    try {
      if (isLogin) {
        await auth?.login(data as LoginFormData);
      } else {
        await auth?.register(data as RegisterFormData);
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ error: string }>;
      const errorMsg = axiosError.response?.data?.error || "An unexpected error occurred";
      setServerError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setGoogleError('Invalid Google credential');
      return;
    }
    setGoogleError(null);
    setIsLoading(true);
    try {
      await auth?.googleLogin(credentialResponse.credential);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ error: string }>;
      const errorMsg = axiosError.response?.data?.error || "Google login failed";
      setGoogleError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = () => {
    setServerError(null);
    setGoogleError(null);
    reset();
    if (isLogin) {
      navigate('/register');
    } else {
      navigate('/login');
    }
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <div className={styles.container}>
        <div className={`${styles.card} card border-0`}>
          <div className="card-body p-5">
            {/* Header */}
            <h1 className={`${styles.title} card-title text-center mb-2`}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-center text-muted mb-4">
              {isLogin
                ? 'Sign in to your TripLens account'
                : 'Join TripLens and start exploring'}
            </p>

            {/* Server Error Alert */}
            {(serverError || googleError) && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Error:</strong> {serverError || googleError}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setServerError(null);
                    setGoogleError(null);
                  }}
                  aria-label="Close"
                />
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
              {/* Username Field (Register Only) */}
              {!isLogin && (
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <input
                    {...register('username')}
                    id="username"
                    type="text"
                    className={`form-control ${
                      'username' in errors && errors.username ? 'is-invalid' : ''
                    }`}
                    placeholder="Choose a username"
                  />
                  {'username' in errors && errors.username && (
                    <div className="invalid-feedback d-block">
                      {errors.username.message}
                    </div>
                  )}
                </div>
              )}

              {/* Email Field */}
              <div className="mb-3">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <div className="invalid-feedback d-block">
                    {errors.email.message}
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div className="mb-4">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  {...register('password')}
                  id="password"
                  type="password"
                  className={`form-control ${
                    errors.password ? 'is-invalid' : ''
                  }`}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <div className="invalid-feedback d-block">
                    {errors.password.message}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`${styles.primaryButton} btn btn-primary w-100 py-2 fw-semibold`}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    {isLogin ? 'Signing In...' : 'Creating Account...'}
                  </>
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className={styles.divider}>
              <span>Or continue with</span>
            </div>

            {/* Google Login Button */}
            <div className="d-flex justify-content-center mb-4">
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setGoogleError('Google login failed')}
                  text="signin"
                />
              ) : (
                <div className="alert alert-warning mb-0" role="alert">
                  Google Sign-in not configured. Please set VITE_GOOGLE_CLIENT_ID in .env
                </div>
              )}
            </div>

            {/* Toggle Auth Mode */}
            <p className="text-center text-muted mb-0">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={handleToggleMode}
                className={`${styles.toggleButton} btn btn-link p-0 fw-semibold text-decoration-none`}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default AuthPage;
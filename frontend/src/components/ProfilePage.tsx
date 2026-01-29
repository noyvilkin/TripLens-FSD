import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getUserProfile, getUserPosts, updateUserProfile } from '../api/userApi';
import { decodeToken } from '../utils/jwt';
import { usernameSchema } from '../types/user';
import type { UserProfile, Post } from '../types/user';
import styles from './ProfilePage.module.css';

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if current user owns this profile
  const loggedInUserId = accessToken ? decodeToken(accessToken)?.userId : null;
  const isOwnProfile = loggedInUserId === userId;

  // Fetch profile and posts
  useEffect(() => {
    if (!userId || authLoading) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch profile and posts in parallel
        const [profileData, postsData] = await Promise.all([
          getUserProfile(userId),
          getUserPosts(userId),
        ]);

        setProfile(profileData);
        setPosts(postsData);
        setEditUsername(profileData.username);
      } catch (err: unknown) {
        const errorMessage =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load profile';

        setError(errorMessage || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, authLoading]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setValidationError('Please select an image file');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setValidationError('Image must be less than 5MB');
        return;
      }

      setSelectedImage(file);
      setValidationError(null);
      setRemovePhoto(false); // Clear remove photo flag if user selects new image

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle username change
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditUsername(value);

    // Validate with Zod
    const result = usernameSchema.safeParse({ username: value });
    if (!result.success) {
      setValidationError(result.error.issues[0].message);
    } else {
      setValidationError(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!accessToken || !userId || !profile) return;

    // Final validation
    const result = usernameSchema.safeParse({ username: editUsername });
    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }

    // Check if anything changed
    if (editUsername === profile.username && !selectedImage && !removePhoto) {
      setIsEditMode(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setValidationError(null);

      const updateData: { username?: string; profileImage?: File | string } = {};

      if (editUsername !== profile.username) {
        updateData.username = editUsername;
      }

      if (removePhoto) {
        // Send empty string to remove photo
        updateData.profileImage = '';
      } else if (selectedImage) {
        updateData.profileImage = selectedImage;
      }

      const updatedProfile = await updateUserProfile(userId, accessToken, updateData);
      setProfile(updatedProfile);
      setIsEditMode(false);
      setSelectedImage(null);
      setImagePreview(null);
      setRemovePhoto(false);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: string | { message?: string }; status?: number } }).response;
          
          // Handle all 400-level errors as validation errors (inline only)
          if (response?.status && response.status >= 400 && response.status < 500) {
            let validationMessage = 'Invalid input';
            
            if (typeof response.data === 'string') {
              validationMessage = response.data;
            } else if (response.data?.message) {
              validationMessage = response.data.message;
            }
          
          setValidationError(validationMessage);
          // Don't set general error for validation issues
        } else {
          // For server errors (5xx), show general error message
          setError('Failed to update profile. Please try again.');
        }
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditMode(false);
    setEditUsername(profile?.username || '');
    setSelectedImage(null);
    setImagePreview(null);
    setRemovePhoto(false);
    setValidationError(null);
    setError(null);
  };

  // Handle remove photo
  const handleRemovePhoto = () => {
    setRemovePhoto(true);
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // Dummy profile image SVG
  const dummyProfileImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#667eea"/>
          <stop offset="100%" stop-color="#764ba2"/>
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="100" fill="url(#g)"/>
      <circle cx="100" cy="80" r="36" fill="rgba(255,255,255,0.9)"/>
      <path d="M40 170c12-30 44-50 60-50s48 20 60 50" fill="rgba(255,255,255,0.9)"/>
    </svg>`
  )}`;

  const profileImageUrl = imagePreview ||
    (profile.profilePic ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${profile.profilePic}` : dummyProfileImage);

  // Safe date formatting
  const joinedDate = profile.createdAt ? new Date(profile.createdAt) : null;
  const isValidDate = joinedDate && !Number.isNaN(joinedDate.getTime());
  const joinDateLabel = isValidDate ? `Member since ${joinedDate.toLocaleDateString()}` : 'New member';

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.profileSection}>
          {/* Profile Image */}
          <div className={styles.imageContainer}>
            <img src={removePhoto ? dummyProfileImage : profileImageUrl} alt={profile.username} className={styles.profileImage} />
            
            {/* Image Upload Buttons (Edit Mode Only) */}
            {isEditMode && isOwnProfile && (
              <div className={styles.photoButtons}>
                <label className={styles.changePhotoButton}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className={styles.fileInput}
                  />
                  {removePhoto || (!profile.profilePic && !imagePreview) ? 'Add' : 'Change'}
                </label>
                {(profile.profilePic || imagePreview) && !removePhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className={styles.removePhotoButton}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className={styles.infoContainer}>
            {isEditMode ? (
              <>
                {/* Edit Mode */}
                <div className={styles.editForm}>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Username</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={handleUsernameChange}
                      className={styles.usernameInput}
                      placeholder="Enter username"
                    />
                    {validationError && (
                      <p className={styles.validationError}>{validationError}</p>
                    )}
                  </div>
                  
                  <div className={styles.editActions}>
                    <button
                      onClick={handleSave}
                      disabled={saving || !!validationError}
                      className={styles.saveButton}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* View Mode */}
                <h1 className={styles.username}>{profile.username}</h1>
                <p className={styles.joinDate}>{joinDateLabel}</p>
                
                {/* Conditional Edit Button */}
                {isOwnProfile && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className={styles.editButton}
                  >
                    Edit Profile
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && <p className={styles.errorMessage}>{error}</p>}
      </div>

      {/* User Posts Gallery */}
      <div className={styles.postsSection}>
        <h2 className={styles.sectionTitle}>
          {isOwnProfile ? 'Your Trips' : `${profile.username}'s Trips`}
        </h2>

        {posts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {isOwnProfile
                ? "You haven't shared any trips yet."
                : "This user hasn't shared any trips yet."}
            </p>
          </div>
        ) : (
          <div className={styles.postsGrid}>
            {posts.map((post) => (
              <div key={post._id} className={styles.postCard}>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postContent}>{post.content}</p>
                {post.createdAt && (
                  <p className={styles.postDate}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;

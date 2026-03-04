import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getUserProfile, getUserPosts, updateUserProfile } from '../api/userApi';
import { updatePost, deletePost } from '../api/postApi';
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
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostEditMode, setIsPostEditMode] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postSaving, setPostSaving] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch profile and posts in parallel
        const [profileData, postsData] = await Promise.all([
          getUserProfile(userId, controller.signal),
          getUserPosts(userId, controller.signal),
        ]);

        if (!isMounted) return;
        setProfile(profileData);
        setPosts(postsData);
        setEditUsername(profileData.username);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as { code?: string }).code;
          if (code === 'ERR_CANCELED') return;
        }

        const errorMessage =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Failed to load profile';

        if (isMounted) {
          setError(errorMessage || 'Failed to load profile');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
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

      const updatedProfile = await updateUserProfile(userId, updateData);
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

  const openPostModal = (post: Post) => {
    setSelectedPost(post);
    setIsPostEditMode(false);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostError(null);
    setActiveImageIndex(0);
  };

  const closePostModal = () => {
    setSelectedPost(null);
    setIsPostEditMode(false);
    setPostError(null);
    setShowDeleteConfirm(false);
  };

  const handlePostSave = async () => {
    if (!accessToken || !selectedPost) return;
    if (!postTitle.trim() || !postContent.trim()) {
      setPostError('Title and description are required.');
      return;
    }

    try {
      setPostSaving(true);
      setPostError(null);

      const updated = await updatePost(selectedPost._id, accessToken, {
        title: postTitle.trim(),
        content: postContent.trim()
      });

      setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedPost(updated);
      setIsPostEditMode(false);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: string | { message?: string } } }).response;
        const message = typeof response?.data === 'string'
          ? response.data
          : response?.data?.message;
        setPostError(message || 'Failed to update post.');
      } else {
        setPostError('Failed to update post.');
      }
    } finally {
      setPostSaving(false);
    }
  };

  const handlePostDelete = async () => {
    if (!accessToken || !selectedPost) return;
    try {
      await deletePost(selectedPost._id, accessToken);
      setPosts((prev) => prev.filter((p) => p._id !== selectedPost._id));
      closePostModal();
    } catch {
      setPostError('Failed to delete post.');
    }
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

  // Default profile image
  const defaultProfileImage = "/user.png";

  const profileImageUrl = imagePreview || (() => {
    if (!profile.profilePic || profile.profilePic.trim() === "") {
      return defaultProfileImage;
    }
    // If it's a data URI (starts with data:), use it directly
    if (profile.profilePic.startsWith('data:')) {
      return defaultProfileImage; // Use our custom user.png instead of the default SVG
    }
    // If it's a relative path, prepend the API URL
    return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${profile.profilePic}`;
  })();

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
            <img 
              src={removePhoto ? defaultProfileImage : profileImageUrl} 
              alt={profile.username} 
              className={styles.profileImage}
              onError={(e) => {
                // If image fails to load, use default image
                const target = e.target as HTMLImageElement;
                if (target.src !== defaultProfileImage) {
                  target.src = defaultProfileImage;
                }
              }}
            />
            
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
              <button
                key={post._id}
                className={styles.postCard}
                onClick={() => openPostModal(post)}
              >
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postContent}>{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className={styles.postImages}>
                    {post.images.slice(0, 4).map((image) => (
                      <img
                        key={image}
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${image}`}
                        alt={post.title}
                        className={styles.postImage}
                      />
                    ))}
                  </div>
                )}
                {post.createdAt && (
                  <p className={styles.postDate}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                )}
                {isOwnProfile && (
                  <div className={styles.postActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={styles.postActionButton}
                      onClick={() => {
                        openPostModal(post);
                        setIsPostEditMode(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.postActionDanger}
                      onClick={() => {
                        openPostModal(post);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPost && (
        <div className={styles.modalOverlay} onClick={closePostModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closePostModal}>
              ×
            </button>

            {selectedPost.images && selectedPost.images.length > 0 && (
              <div className={styles.modalImages}>
                <button
                  className={styles.carouselButton}
                  onClick={() =>
                    setActiveImageIndex((prev) =>
                      prev === 0 ? selectedPost.images.length - 1 : prev - 1
                    )
                  }
                  aria-label="Previous image"
                  type="button"
                >
                  ‹
                </button>
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${selectedPost.images[activeImageIndex]}`}
                  alt={selectedPost.title}
                  className={styles.modalImage}
                  onClick={() =>
                    setFullImageUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${selectedPost.images[activeImageIndex]}`)
                  }
                />
                <button
                  className={styles.carouselButton}
                  onClick={() =>
                    setActiveImageIndex((prev) =>
                      prev === selectedPost.images.length - 1 ? 0 : prev + 1
                    )
                  }
                  aria-label="Next image"
                  type="button"
                >
                  ›
                </button>
              </div>
            )}

            {isPostEditMode ? (
              <div className={styles.modalContent}>
                <label className={styles.modalLabel}>Title</label>
                <input
                  className={styles.modalInput}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                />
                <label className={styles.modalLabel}>Description</label>
                <textarea
                  className={styles.modalTextarea}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={5}
                />
                {postError && <p className={styles.modalError}>{postError}</p>}
                <div className={styles.modalActions}>
                  <button
                    className={styles.modalPrimary}
                    onClick={handlePostSave}
                    disabled={postSaving}
                  >
                    {postSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className={styles.modalSecondary}
                    onClick={() => setIsPostEditMode(false)}
                    disabled={postSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.modalContent}>
                <h3 className={styles.modalTitle}>{selectedPost.title}</h3>
                <p className={styles.modalText}>{selectedPost.content}</p>
                {selectedPost.createdAt && (
                  <p className={styles.modalDate}>
                    {new Date(selectedPost.createdAt).toLocaleDateString()}
                  </p>
                )}
                {postError && <p className={styles.modalError}>{postError}</p>}
                {isOwnProfile && (
                  <div className={styles.modalActions}>
                    <button
                      className={styles.modalPrimary}
                      onClick={() => setIsPostEditMode(true)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.modalDanger}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedPost && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete this post?</h3>
            <p className={styles.confirmText}>This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalDanger} onClick={handlePostDelete}>
                Delete
              </button>
              <button className={styles.modalSecondary} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {fullImageUrl && (
        <div className={styles.modalOverlay} onClick={() => setFullImageUrl(null)}>
          <div className={styles.fullImageWrap} onClick={(e) => e.stopPropagation()}>
            <img src={fullImageUrl} alt="Full size" className={styles.fullImage} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

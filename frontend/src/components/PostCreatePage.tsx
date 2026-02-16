import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createPost } from '../api/postApi';
import { decodeToken } from '../utils/jwt';
import styles from './PostCreatePage.module.css';

const PostCreatePage: React.FC = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = Array.from(e.target.files || []);
    if (inputFiles.length === 0) return;

    for (const file of inputFiles) {
      if (!file.type.startsWith('image/')) {
        setValidationError('Please select image files only');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setValidationError('Each image must be less than 5MB');
        return;
      }
    }

    const nextImages = [...selectedImages, ...inputFiles];
    if (nextImages.length > 6) {
      setValidationError('You can upload up to 6 photos.');
      return;
    }

    setSelectedImages(nextImages);
    setValidationError(null);
    setError(null);
    setSuccessMessage(null);

    Promise.all(
      nextImages.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
      )
    ).then(setImagePreviews);

    if (e.target.value) {
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const nextImages = selectedImages.filter((_, i) => i !== index);
    const nextPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(nextImages);
    setImagePreviews(nextPreviews);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessToken) {
      setError('You must be logged in to create a post.');
      return;
    }

    if (!title.trim() || !content.trim()) {
      setValidationError('Title and description are required.');
      return;
    }

    if (selectedImages.length === 0) {
      setValidationError('At least one photo is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setValidationError(null);
      setSuccessMessage(null);

      const userId = decodeToken(accessToken)?.userId;

      await createPost(accessToken, {
        title: title.trim(),
        content: content.trim(),
        images: selectedImages
      });
      setTitle('');
      setContent('');
      setSelectedImages([]);
      setImagePreviews([]);
      setSuccessMessage('Post created successfully. Redirecting...');

      setTimeout(() => {
        if (userId) {
          navigate(`/profile/${userId}`);
        } else {
          navigate('/');
        }
      }, 700);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: string | { message?: string }; status?: number } }).response;
        const message = typeof response?.data === 'string'
          ? response.data
          : response?.data?.message;
        setError(message || 'Failed to create post. Please try again.');
      } else {
        setError('Failed to create post. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Create a Post</h1>
          <p className={styles.subtitle}>Share your trip story and a favorite photo.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="title" className={styles.label}>Trip title</label>
            <input
              id="title"
              type="text"
              className={styles.input}
              placeholder="Golden Hour in Santorini"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setValidationError(null);
                setError(null);
              }}
              maxLength={120}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="content" className={styles.label}>Trip description</label>
            <textarea
              id="content"
              className={styles.textarea}
              placeholder="Tell the story of your trip..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setValidationError(null);
                setError(null);
              }}
              rows={6}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Trip photos (required)</label>
            <div className={styles.photoRow}>
              <label className={styles.photoButton}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className={styles.fileInput}
                />
                Choose Photos
              </label>
            </div>
            {selectedImages.length > 0 && (
              <p className={styles.helperText}>Selected: {selectedImages.length} photos</p>
            )}
            {imagePreviews.length > 0 && (
              <div className={styles.previewGrid}>
                {imagePreviews.map((preview, index) => (
                  <div key={preview} className={styles.previewBox}>
                    <img src={preview} alt={`Preview ${index + 1}`} className={styles.previewImage} />
                    <button
                      type="button"
                      className={styles.previewRemove}
                      onClick={() => handleRemoveImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {validationError && <p className={styles.validationError}>{validationError}</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}
          {successMessage && <p className={styles.successMessage}>{successMessage}</p>}

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={submitting}>
              {submitting ? 'Posting...' : 'Create Post'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCreatePage;

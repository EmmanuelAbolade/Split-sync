// src/components/ProfilePhotoUpload.test.jsx
// Tests for ProfilePhotoUpload - rendering, photo display, upload flow,
// file validation (type, size), error handling, uploading state

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUploadBytes    = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockUpdateDoc      = jest.fn();
const mockRef            = jest.fn(() => 'storage-ref');
const mockDoc            = jest.fn(() => 'doc-ref');

jest.mock('firebase/storage', () => ({
  ref:             (...args) => mockRef(...args),
  uploadBytes:     (...args) => mockUploadBytes(...args),
  getDownloadURL:  (...args) => mockGetDownloadURL(...args),
}));

jest.mock('firebase/firestore', () => ({
  doc:       (...args) => mockDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
}));

jest.mock('../services/firebase', () => ({
  storage: {},
  db:      {},
}));

import ProfilePhotoUpload from './ProfilePhotoUpload';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { uid: 'user-123', displayName: 'Alice', email: 'alice@example.com' };
const mockOnPhotoUpdated = jest.fn();

const makeFile = (name = 'photo.jpg', type = 'image/jpeg', size = 1024) => {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

beforeEach(() => {
  jest.clearAllMocks();
  // Restore doc mock return value after clearAllMocks wipes it
  mockDoc.mockReturnValue('doc-ref');
});

// ---------------------------------------------------------------------------
// 1. Rendering
// ---------------------------------------------------------------------------

describe('ProfilePhotoUpload - Rendering', () => {

  test('Renders upload button', () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  test('Shows user initial when no photo URL', () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  test('Shows profile image when photoURL is provided', () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL="https://example.com/photo.jpg"
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const img = screen.getByAltText('Profile');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  test('Falls back to email initial when displayName is not set', () => {
    render(
      <ProfilePhotoUpload
        user={{ uid: 'u1', displayName: null, email: 'bob@example.com' }}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  test('File input accepts image files only', () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept', 'image/*');
  });
});

// ---------------------------------------------------------------------------
// 2. File validation
// ---------------------------------------------------------------------------

describe('ProfilePhotoUpload - Validation', () => {

  test('Shows error for non-image file type', async () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(screen.getByText('Please select an image file')).toBeInTheDocument();
  });

  test('Shows error for file exceeding 5MB', async () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    const largeFile = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
    await act(async () => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });
    expect(screen.getByText('Image size must be less than 5MB')).toBeInTheDocument();
  });

  test('Does not upload when no file selected', async () => {
    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    await act(async () => {
      fireEvent.change(input, { target: { files: [] } });
    });
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Upload flow
// ---------------------------------------------------------------------------

describe('ProfilePhotoUpload - Upload', () => {

  test('Calls uploadBytes with correct file', async () => {
    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue('https://new-photo.jpg');
    mockUpdateDoc.mockResolvedValue(undefined);

    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    const file = makeFile();
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(mockUploadBytes).toHaveBeenCalled();
  });

  test('Calls onPhotoUpdated with new URL on success', async () => {
    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue('https://new-photo.jpg');
    mockUpdateDoc.mockResolvedValue(undefined);

    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await waitFor(() =>
      expect(mockOnPhotoUpdated).toHaveBeenCalledWith('https://new-photo.jpg')
    );
  });

  test('Calls updateDoc to save photo URL to Firestore', async () => {
    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue('https://new-photo.jpg');
    mockUpdateDoc.mockResolvedValue(undefined);

    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await waitFor(() =>
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({ photoURL: 'https://new-photo.jpg' })
      )
    );
  });

  test('Shows error message when upload fails', async () => {
    mockUploadBytes.mockRejectedValue(new Error('Storage error'));

    render(
      <ProfilePhotoUpload
        user={mockUser}
        currentPhotoURL={null}
        onPhotoUpdated={mockOnPhotoUpdated}
      />
    );
    const input = document.querySelector('input[type="file"]');
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await waitFor(() =>
      expect(screen.getByText('Failed to upload photo. Please try again.')).toBeInTheDocument()
    );
  });
});

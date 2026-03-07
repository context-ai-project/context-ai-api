/**
 * Media Storage Interface (IMediaStorage)
 *
 * Defines the contract for object/blob storage of media files.
 * Follows Dependency Inversion Principle — domain defines the port,
 * infrastructure provides the adapter (GCS, S3, etc.).
 */

/** Result returned after a successful upload */
export interface UploadResult {
  /** Public or internal path of the stored file */
  path: string;
  /** Full URL to access the file (signed or public) */
  url: string;
  /** MIME type of the stored file */
  contentType: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * IMediaStorage
 *
 * Port for cloud object storage services.
 * Implementations: GcsStorageService.
 */
export interface IMediaStorage {
  /**
   * Uploads a file to the storage backend.
   *
   * @param fileBuffer - Raw file content
   * @param storagePath - Destination path inside the bucket (e.g. capsules/{id}/audio.mp3)
   * @param contentType - MIME type (e.g. audio/mpeg)
   * @returns Upload result with path and URL
   */
  upload(
    fileBuffer: Buffer,
    storagePath: string,
    contentType: string,
  ): Promise<UploadResult>;

  /**
   * Generates a time-limited signed URL for accessing a private file.
   *
   * @param storagePath - Path inside the bucket
   * @param expiresInMinutes - Validity window (default: 60 minutes)
   * @returns Signed URL string
   */
  getSignedUrl(storagePath: string, expiresInMinutes?: number): Promise<string>;

  /**
   * Deletes a file from the storage backend.
   *
   * @param storagePath - Path inside the bucket
   */
  delete(storagePath: string): Promise<void>;
}

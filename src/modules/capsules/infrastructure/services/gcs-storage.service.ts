import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { extractErrorMessage } from '@shared/utils';
import type {
  IMediaStorage,
  UploadResult,
} from '../../domain/services/media-storage.interface';

// GCS constants (OWASP: Magic Numbers)
const DEFAULT_SIGNED_URL_EXPIRY_MINUTES = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MILLISECONDS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const GCS_ACTION_READ = 'read' as const;

/**
 * GcsStorageService
 *
 * Implements IMediaStorage using Google Cloud Storage.
 *
 * Path convention:
 *   capsules/{capsuleId}/audio.mp3
 *   capsules/{capsuleId}/video.mp4
 *
 * Environment variables:
 * - GCS_BUCKET_CAPSULES: target bucket name
 * - GCS_PROJECT_ID: GCP project ID
 * - GCS_KEY_FILE: path to service account JSON key (optional in GKE/Cloud Run)
 */
@Injectable()
export class GcsStorageService implements IMediaStorage {
  private readonly logger = new Logger(GcsStorageService.name);
  private readonly storage: Storage;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.GCS_BUCKET_CAPSULES;
    if (!bucket) {
      throw new Error(
        'GCS_BUCKET_CAPSULES environment variable is required for media storage',
      );
    }
    this.bucket = bucket;

    const storageOptions: ConstructorParameters<typeof Storage>[0] = {
      projectId: process.env.GCS_PROJECT_ID,
    };

    if (process.env.GCS_KEY_FILE) {
      storageOptions.keyFilename = process.env.GCS_KEY_FILE;
    }

    this.storage = new Storage(storageOptions);
    this.logger.log(`GcsStorageService initialized — bucket: ${this.bucket}`);
  }

  async upload(
    fileBuffer: Buffer,
    storagePath: string,
    contentType: string,
  ): Promise<UploadResult> {
    const file = this.storage.bucket(this.bucket).file(storagePath);

    try {
      await file.save(fileBuffer, {
        contentType,
        resumable: false,
      });

      this.logger.log(
        `Uploaded ${storagePath} to GCS (${fileBuffer.length} bytes)`,
      );

      return {
        path: storagePath,
        url: `gs://${this.bucket}/${storagePath}`,
        contentType,
        sizeBytes: fileBuffer.length,
      };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to upload ${storagePath}: ${message}`);
      throw new Error(`GCS upload failed: ${message}`);
    }
  }

  async getSignedUrl(
    storagePath: string,
    expiresInMinutes: number = DEFAULT_SIGNED_URL_EXPIRY_MINUTES,
  ): Promise<string> {
    const file = this.storage.bucket(this.bucket).file(storagePath);
    const expiresMs = Date.now() + expiresInMinutes * MINUTES_TO_MILLISECONDS;

    try {
      const [url] = await file.getSignedUrl({
        action: GCS_ACTION_READ,
        expires: expiresMs,
      });

      return url;
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(
        `Failed to get signed URL for ${storagePath}: ${message}`,
      );
      throw new Error(`GCS signed URL generation failed: ${message}`);
    }
  }

  async delete(storagePath: string): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(storagePath);

    try {
      await file.delete({ ignoreNotFound: true });
      this.logger.log(`Deleted ${storagePath} from GCS`);
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to delete ${storagePath}: ${message}`);
      throw new Error(`GCS delete failed: ${message}`);
    }
  }
}

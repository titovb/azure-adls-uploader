import {FileItem} from './file-item';

export interface Config {
  chunkSize?: number;
  chunkUploadRetries?: number;

  getItemUploadUrl: (item: FileItem) => Promise<string> | string;

  onItemStart?: (item: FileItem) => Promise<void> | void;
  onItemProgress?: (item: FileItem) => void;
  onItemComplete?: (item: FileItem) => Promise<void> | void;
  onItemError?: (item: FileItem, error: Error) => Promise<void> | void;

  onStart?: () => Promise<void> | void;
  onProgress?: (progress: number) => void;
  onComplete?: () => Promise<void> | void;
}

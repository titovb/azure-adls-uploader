import {DataLakeFileClient} from '@azure/storage-file-datalake';
import {FileItem, IFileItem} from './file-item';
import {Config} from './config';

export class Uploader {
  private config: Required<Config>;

  private _abortController = new AbortController();

  private _progress: number = 0;
  private _size: number = 0;
  private _uploadedBytes: number = 0;
  private _isUploading: boolean = false;

  private _queue: IFileItem[] = [];

  constructor(config: Config) {
    this.config = {
      getItemUploadUrl: config.getItemUploadUrl,

      chunkSize: this.isPositiveInteger(config.chunkSize) ? config.chunkSize : 1024 * 1024 * 100,
      chunkUploadRetries: this.isPositiveInteger(config.chunkUploadRetries) ? config.chunkUploadRetries : 5,

      onItemStart: config.onItemStart || (() => {}),
      onItemProgress: config.onItemProgress || (() => {}),
      onItemComplete: config.onItemComplete || (() => {}),
      onItemError: config.onItemError || (() => {}),

      onStart: config.onStart || (() => {}),
      onProgress: config.onProgress || (() => {}),
      onComplete: config.onComplete || (() => {})
    };
  }

  private async uploadItem(item: IFileItem): Promise<void> {
    try {
      item.isUploading = true;
      await this.config.onItemStart(item);
      await this.uploadFile(item);
      item.isUploading = false;
      await this.config.onItemComplete(item);
    } catch (err) {
      item.isUploading = false;
      this.config.onItemError(item, err);
    }
  }

  private async uploadFile(item: IFileItem): Promise<void> {
    let fileClient = await this.getFileClient(item);
    await fileClient?.create();
    let retries = 1;
    while (item.uploadedBytes < item.file.size) {
      if (!this._isUploading) return;
      try {
        await this.uploadChunk(fileClient, item);
        retries = 0;
      } catch(err) {
        if (retries < this.config.chunkUploadRetries) {
          retries++;
        } else {
          throw err;
        }
      }
      fileClient = await this.getFileClient(item);
    }
    await fileClient?.flush(item.file.size, {close: true, pathHttpHeaders: {contentType: item.file.type}});
  }

  private async getFileClient(item: IFileItem): Promise<DataLakeFileClient | undefined> {
    if (!this._isUploading) return;
    const uploadUrl = await this.config.getItemUploadUrl(item);
    return new DataLakeFileClient(uploadUrl);
  }

  private async uploadChunk(client: DataLakeFileClient | undefined, item: IFileItem): Promise<void> {
    const blob = item.file.slice(item.uploadedBytes, Math.min(item.uploadedBytes + this.config.chunkSize, item.file.size));
    await client?.append(blob, item.uploadedBytes, blob.size, {
      onProgress: this.onUploadProgress.bind(this, item),
      abortSignal: this._abortController.signal
    });
  }

  private onUploadProgress(item: IFileItem, progress: {loadedBytes: number}): void {
    this._uploadedBytes += progress.loadedBytes - item.uploadedBytes;
    this._progress = this._uploadedBytes / this._size * 100;

    item.uploadedBytes += progress.loadedBytes - item.uploadedBytes;
    item.progress = item.uploadedBytes / item.file.size * 100;

    this.config.onItemProgress(item);
    this.config.onProgress(this._progress);
  }

  private isPositiveInteger(value: number | undefined): value is number {
    return !!value && Number.isInteger(value) && value > 0;
  }

  get queue(): ReadonlyArray<FileItem> {
    return this._queue;
  }

  get isUploading(): boolean {
    return this._isUploading;
  }

  get size(): number {
    return this._size;
  }

  get uploadedBytes(): number {
    return this._uploadedBytes;
  }

  get progress(): number {
    return this._progress;
  }

  public addFiles(files: File[] | FileList): void {
    Array.from(files).forEach(this.addFile.bind(this));
  }

  public addFile(file: File): void {
    if (this._queue.some(item => item.file.name === file.name)) return;
    this._queue.push({file, uploadedBytes: 0, progress: 0, isUploading: false});
    this._size += file.size;
  }

  public removeItem(item: FileItem): void {
    this.removeFile(item.file);
  }

  public removeFile(file: File): void {
    const item = this._queue.find(i => i.file.name === file.name && !i.isUploading);
    if (!item) return;
    this._queue = this._queue.filter(i => i.file.name !== item.file.name);
    this._size -= item.file.size;
  }

  public clearQueue(): void {
    this._queue = this._queue.filter(i => i.isUploading);
    this._size = this._queue.reduce((acc, item) => acc + item.file.size, 0);
  }

  public cancel(): void {
    this._abortController.abort();
    const uplItem = this._queue.find(i => i.isUploading);
    if (uplItem) uplItem.isUploading = false;
    this._isUploading = false;
  }

  public async upload(): Promise<void> {
    const items = Array.from(this._queue);
    this._isUploading = true;
    await this.config.onStart();
    for (const item of items) {
      if (!this._isUploading) return;
      if (item.progress === 100) continue;
      await this.uploadItem(item);
    }
    this._isUploading = false;
    await this.config.onComplete();
  }
}

export interface IFileItem {
  file: File;
  progress: number;
  uploadedBytes: number;
  isUploading: boolean;
  payload?: any;
}

export type FileItem = Readonly<IFileItem> & Partial<Record<'payload', string>>;

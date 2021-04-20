# Azure Data Lake Storage Uploader
## Overview
This is a small client library to upload files to
[Azure Data Lake Storage (ADLS)](https://docs.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction)
using [SAS URL](https://docs.microsoft.com/en-us/azure/storage/common/storage-sas-overview). Library uses
[@azure/storage-file-datalake](https://www.npmjs.com/package/@azure/storage-file-datalake) package to communicate with ADLS.

## Installation
* `npm i --save azure-adls-uploader`

## API
### ADLSConfig
Config for ADLSUploader.

* **chunkSize: number** - *Optional*. *Default: 104857600 (100mb)*. It is the max size of chunk to be uppended to ADLS file. ADLSUploader splits files to chunks using this param.
* **chunkUploadRetries: number** - *Optional*. *Default: 5*. It is the count of retries of one chunk appending.
*  **
* **getItemUploadUrl(item: FileItem): Promise\<string> | string** - *Required*. Will be executed to get SAS URL for file.
*  **
* **onItemStart(item: FileItem): Promise\<void> | void** - *Optional*. Will be executed before starting file upload.
* **onItemProgress(item: FileItem): Promise\<void> | void** - *Optional*. Will be executed when file uploading progress has updated.
* **onItemComplete(item: FileItem): Promise\<void> | void** - *Optional*. Will be executed when file uploading has completed.
* **onItemError(item: FileItem): Promise\<void> | void** - *Optional*. Will be executed when file uploading has failed.
*  **
* **onStart(): Promise\<void> | void** - *Optional*. Will be executed before starting uploading process.
* **onProgress(progress: number): Promise\<void> | void** - *Optional*. Will be executed when uploading progress has updated.
* **onComplete(): Promise\<void> | void** - *Optional*. Will be executed when uploading process has completed.

### FileItem
Represents a file with additional information in ADLSUploader queue.
* **file: File** - *Readonly*. File object.
* **progress: number** - *Readonly*. Uploading progress in percent.
* **uploadedBytes: number** - *Readonly*. Uploaded bytes.
* **isUploading: boolean** - *Readonly*. If FileItem uploading process in progress.
* **payload: any** - *Optional*. Useful to transfer some data between hooks.

### ADLSUploader
File uploader. To create use `const uploader = new ADLSUploader(adlsConfig);`.
* **queue: ReadonlyArray\<FileItem>** - *Readonly*. Queue of files to upload.
* **isUploading: boolean** - *Readonly*. If uploading in progress.
* **size: number** - *Readonly*. Size of files in queue.
* **uploadedBytes: number** - *Readonly*. Uploaded bytes from current uploading process.
* **progress: number** - *Readonly*. Progress of current uploading process.
* **
* **addFiles(files: File[] | FileList): void** - Add files to queue. Files in queue should have unique names. Adding files with names that have already existed will do nothing.
* **addFile(file: File): void** - Add file to queue. Files in queue should have unique names. Adding file with name that has already existed will do nothing.
* **removeItem(file: FileItem): void** - Remove FileItem from queue. Will not be removed if uploader currently uploads this file. Will do nothing if file doesn't exist in queue.
* **removeFile(file: File): void** - Remove file from queue. Will not be removed if uploader currently uploads this file. Will do nothing if file doesn't exist in queue.
* **clearQueue(): void** - Remove all files from queue. If uploader currently uploads file, this file will not be removed.
* **
* **upload(): Promise\<void>** - Upload files from queue to ADLS.
* **cancel(): void** - Cancel uploading process.

## Usage example

``` typescript
import {ADLSUploader, ADLSConfig} from 'azure-adls-uploader';

const config: ADLSConfig = {
  getItemUploadUrl: (item: FileItem) => {
    // get sas url functionality
  },
  onItemStart: (item: FileItem) => {
    console.log(`File ${item.file.name}: upload progress start`);
  },
  onItemProgress: (item: FileItem) => {
    console.log(`File ${item.file.name}: upload progress ${item.progress}%`);
  },
  onItemComplete: (item: FileItem) => {
    console.log(`File ${item.file.name}: upload complete`);
  },
  onItemError: (item: FileItem, error) => {
    console.log(`File ${item.file.name}: upload error occured`, error);
  },
  onStart: () => {
    console.log(`Upload start`);
  },
  onProgress: (progress: number) => {
    console.log(`Progress: ${progress}%`);
  },
  onComplete: () => {
    console.log(`Upload complete`);
  }
};

const uploader = new ADLSUploader(config);

// on add file action
function addFile(file: File): void {
  uploader.addFile(file);
}

// on remove file
function removeFile(file: File): void {
  uploader.removeFile(file);
}

// on remove all files
function removeFiles(): void {
  uploader.clearQueue();
}

// on submit
function uploadFiles(): Promise<void> {
  return uploader.upload();
}

// on cancel
function cancelUploading(): void {
  uploader.cancel();
}
```

Also, you can find basic example on [github](https://github.com/titovb/azure-adls-uploader/tree/main/example/typescript).

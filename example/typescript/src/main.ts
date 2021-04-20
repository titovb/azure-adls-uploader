import {ADLSUploader, ADLSUploaderConfig, FileItem} from 'azure-adls-uploader';

const url = ''; // link to adls blob container
const sasToken = '' // sas token

const config: ADLSUploaderConfig = {
  getItemUploadUrl: (item: FileItem) => {
    return `${url}/${item.file.name}${sasToken}`; // in case of real application, there should be functionality of getting short-lived sas url from server
  },
  onItemStart: (item: FileItem) => {
    updateStatus(`File ${item.file.name} uploading start`);
  },
  onItemProgress: (item: FileItem) => {
    updateStatus(`File ${item.file.name} uploading progress update: ${item.progress}`);
  },
  onItemComplete: (item: FileItem) => {
    updateStatus(`File ${item.file.name} uploading complete`);
  },
  onItemError: (item: FileItem, error: Error) => {
    updateStatus(`File ${item.file.name} uploading error`);
  },
  onStart: () => {
    updateStatus(`Uploading start`);
  },
  onProgress: (progress: number) => {
    const progressSpan = document.createElement('span');
    progressSpan.append(`Progress: ${progress}%`);
    progressSpan.id = 'progress';
    document.getElementById('progress').replaceWith(progressSpan);
  },
  onComplete: () => {
    updateStatus(`Uploading complete`);
  }
}

const uploader = new ADLSUploader(config);

const filesInput = document.getElementById('filesInput');
filesInput.addEventListener('change', (event) => {
  uploader.addFiles((event.target as HTMLInputElement & EventTarget).files);
});

const uploadBtn = document.getElementById('uploadBtn');
uploadBtn.addEventListener('click', () => {
  uploader.upload().then(clearQueue);
});

const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', clearQueue);

const cancelBtn = document.getElementById('cancelBtn');
cancelBtn.addEventListener('click', () => {
  uploader.cancel();
});

function clearQueue(): void {
  (filesInput as HTMLInputElement).value = '';
  uploader.clearQueue();
}

function updateStatus(status: string): void {
  const br = document.createElement('br');
  document.getElementById('status').append(status, br);
}

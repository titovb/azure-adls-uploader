import {ADLSUploader, ADLSUploaderConfig, FileItem} from '../src';

const dataLakeFileClientCreateSpy = jest.fn();
const dataLakeFileClientAppendSpy = jest.fn();
const dataLakeFileClientFlushSpy = jest.fn();

jest.mock('@azure/storage-file-datalake', () => ({
  DataLakeFileClient: jest.fn(() => ({
    create: dataLakeFileClientCreateSpy,
    append: dataLakeFileClientAppendSpy,
    flush: dataLakeFileClientFlushSpy
  }))
}));

const abortSpy = jest.fn();

global.AbortController = class {
  readonly signal = {} as AbortSignal;
  abort = abortSpy;
}

function getFileSpy(name?: string, size?: number): File {
  return {
    name: name || 'file',
    size: size || 1,
    type: 'image/png',
    slice: jest.fn().mockImplementation((a, b) => ({size: b - a}))
  } as any;
}

describe('Uploader unit tests', () => {

  it('should create uploader using config', () => {
    const uploader = new ADLSUploader({
      getItemUploadUrl: () => 'url'
    });

    expect(uploader).toBeDefined();
    expect(uploader.size).toBe(0);
    expect(uploader.uploadedBytes).toBe(0);
    expect(uploader.isUploading).toBeFalsy();
    expect(Array.isArray(uploader.queue)).toBeTruthy();
    expect(uploader.queue.length).toBe(0);
  });

  describe('addFile method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should add FileItem to queue', () => {
      const file = getFileSpy();
      uploader.addFile(file);
      expect(uploader.queue.length).toBe(1);
      expect(uploader.queue[0]).toStrictEqual({file, uploadedBytes: 0, progress: 0, isUploading: false});
    });

    it('should add file size to uploader size property', () => {
      const file = getFileSpy();
      const file2 = getFileSpy('file2', 150);
      uploader.addFile(file);
      uploader.addFile(file2);
      expect(uploader.size).toBe(file.size + file2.size);
    });

    it('should not add file with name that already exists', () => {
      const file = getFileSpy();
      const file2 = getFileSpy();
      uploader.addFile(file);
      uploader.addFile(file2);
      expect(uploader.queue.length).toBe(1);
    });
  });

  describe('addFiles method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should call addFile method', () => {
      const files = [getFileSpy('file1'), getFileSpy('file2'), getFileSpy('file3')];

      const addFileSpy = jest.spyOn(uploader, 'addFile').mockReturnValueOnce(undefined);

      uploader.addFiles(files);

      expect(addFileSpy).toHaveBeenCalledTimes(files.length);
    });
  });

  describe('removeFile method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should remove FileItem from queue', () => {
      const file = getFileSpy();

      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file: File) {
          this._queue.push({file});
        }.bind(uploader)
      );

      uploader.addFile(file);
      uploader.removeFile(file);

      expect(uploader.queue.length).toBe(0);
    });

    it('should remove file size from uploader size property', () => {
      const file = getFileSpy();

      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file: File) {
          this._queue.push({file});
          this._size += file.size;
        }.bind(uploader)
      );

      uploader.addFile(file);
      uploader.removeFile(file);

      expect(uploader.size).toBe(0);
    });

    it('should do nothing if file not found', () => {
      const file = getFileSpy();
      const file2 = getFileSpy('file2');

      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file: File) {
          this._queue.push({file});
          this._size += file.size;
        }.bind(uploader)
      );

      uploader.addFile(file);
      uploader.removeFile(file2);

      expect(uploader.queue.length).toBe(1);
      expect(uploader.size).toBe(file.size);
    });

    it('should do nothing if FileItem isUploading property is true', () => {
      const file = getFileSpy();

      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file: File) {
          this._queue.push({file, isUploading: true});
          this._size += file.size;
        }.bind(uploader)
      );

      uploader.addFile(file);
      uploader.removeFile(file);

      expect(uploader.queue.length).toBe(1);
      expect(uploader.size).toBe(file.size);
    });

    afterEach(() => jest.clearAllMocks());
  });

  describe('removeItem method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should call removeFile method', () => {
      const item = {file: getFileSpy()} as FileItem;
      const removeFileSpy = jest.spyOn(uploader, 'removeFile').mockReturnValueOnce(undefined);

      uploader.removeItem(item);

      expect(removeFileSpy).toHaveBeenCalled();
      expect(removeFileSpy).toHaveBeenCalledWith(item.file);
    });
  });

  describe('clearQueue method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should clear queue', () => {
      const files = [getFileSpy(), getFileSpy(), getFileSpy()];
      jest.spyOn(uploader, 'addFiles').mockImplementationOnce(
        function (files) {
          this._queue.push(...files.map(f => ({file: f})));
        }.bind(uploader)
      );

      uploader.addFiles(files);
      uploader.clearQueue();

      expect(uploader.queue.length).toBe(0);
    });

    it('should update size property', () => {
      const files = [getFileSpy(), getFileSpy(), getFileSpy()];
      jest.spyOn(uploader, 'addFiles').mockImplementationOnce(
        function (files) {
          this._size = files.reduce((acc, file) => acc + file.size, 0);
        }.bind(uploader)
      );

      uploader.addFiles(files);
      uploader.clearQueue();

      expect(uploader.size).toBe(0);
    });

    it('should not remove FileItem if its isUploading property is true', () => {
      const file = getFileSpy();
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file) {
          this._queue.push({file, isUploading: true});
          this._size += file.size;
        }.bind(uploader)
      );

      uploader.addFile(file);
      uploader.clearQueue();

      expect(uploader.queue.length).toBe(1);
      expect(uploader.size).toBe(file.size);
    });

    afterEach(() => jest.clearAllMocks());
  });

  describe('upload method', () => {
    const config: ADLSUploaderConfig = {
      getItemUploadUrl: () => 'url',

      onItemStart: () => {},
      onItemProgress: () => {},
      onItemComplete: () => {},
      onItemError: () => {},

      onStart: () => {},
      onProgress: () => {},
      onComplete: () => {},
    };
    let uploader: ADLSUploader;

    beforeEach(() => {
      dataLakeFileClientCreateSpy.mockResolvedValue(undefined);
      dataLakeFileClientAppendSpy.mockImplementation((a, b, c, opt) => {
        opt.onProgress({loadedBytes: 1});
        return Promise.resolve();
      });
      dataLakeFileClientFlushSpy.mockResolvedValue(undefined);

      jest.spyOn(config, 'getItemUploadUrl').mockReturnValueOnce('abc');

      jest.spyOn(config, 'onItemStart').mockReturnValueOnce(undefined);
      jest.spyOn(config, 'onItemProgress').mockReturnValueOnce(undefined);
      jest.spyOn(config, 'onItemComplete').mockReturnValueOnce(undefined);
      jest.spyOn(config, 'onItemError').mockReturnValueOnce(undefined);

      jest.spyOn(config, 'onStart').mockReturnValueOnce(undefined);
      jest.spyOn(config, 'onProgress').mockReturnValueOnce(undefined);
      jest.spyOn(config, 'onComplete').mockReturnValueOnce(undefined);

      uploader = new ADLSUploader(config);
    });

    it('should call hooks', async () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function (file) {
          this._queue.push({file, progress: 0, uploadedBytes: 0, isUploading: false});
        }.bind(uploader)
      );

      const file = getFileSpy();

      uploader.addFile(file);
      await uploader.upload();

      expect(config.getItemUploadUrl).toHaveBeenCalled();

      expect(config.onItemStart).toHaveBeenCalled();
      expect(config.onItemProgress).toHaveBeenCalled();
      expect(config.onItemComplete).toHaveBeenCalled();

      expect(config.onItemError).not.toHaveBeenCalled();

      expect(config.onStart).toHaveBeenCalled();
      expect(config.onProgress).toHaveBeenCalled();
      expect(config.onComplete).toHaveBeenCalled();
    });

    it('should call start & complete item hooks N (queue length) times and general hooks once', async () => {
      jest.spyOn(uploader, 'addFiles').mockImplementationOnce(
        function(files) {
          this._queue.push(...files.map(file => ({file, progress: 0, uploadedBytes: 0, isUploading: false})));
        }.bind(uploader)
      );

      const files = [getFileSpy(), getFileSpy(), getFileSpy()];

      uploader.addFiles(files);
      await uploader.upload();

      expect(config.onItemStart).toHaveBeenCalledTimes(3);
      expect(config.onItemComplete).toHaveBeenCalledTimes(3);

      expect(config.onStart).toHaveBeenCalledTimes(1);
      expect(config.onComplete).toHaveBeenCalledTimes(1);
    });

    it('should call item error hook when error occurred', async () => {
      jest.spyOn(uploader, 'addFiles').mockImplementationOnce(
        function(files) {
          this._queue.push(...files.map(file => ({file, progress: 0, uploadedBytes: 0, isUploading: false})));
        }.bind(uploader)
      );

      dataLakeFileClientCreateSpy.mockRejectedValue('error');

      const files = [getFileSpy(), getFileSpy(), getFileSpy()];

      uploader.addFiles(files);
      await uploader.upload();

      expect(config.onStart).toHaveBeenCalledTimes(1);
      expect(config.onItemStart).toHaveBeenCalledTimes(3);
      expect(config.onItemError).toHaveBeenCalledTimes(3);
      expect(config.onComplete).toHaveBeenCalledTimes(1);
    });

    it('should set isUploading property', async () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function(file) {
          this._queue.push({file, progress: 0, uploadedBytes: 0, isUploading: false});
        }.bind(uploader)
      );

      const file = getFileSpy();

      uploader.addFile(file);

      dataLakeFileClientAppendSpy.mockImplementation((a, b, c, opt) => {
        opt.onProgress({loadedBytes: 1});
        return new Promise(res => setTimeout(() => res(undefined), 0));
      })

      const op = uploader.upload();
      expect(uploader.isUploading).toBeTruthy();
      await op;
      expect(uploader.isUploading).toBeFalsy();
    });

    it('should call dataLakeFileClient methods', async () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function(file) {
          this._queue.push({file, progress: 0, uploadedBytes: 0, isUploading: false});
        }.bind(uploader)
      );

      uploader.addFile(getFileSpy());
      await uploader.upload();

      expect(dataLakeFileClientAppendSpy).toHaveBeenCalled();
      expect(dataLakeFileClientCreateSpy).toHaveBeenCalled();
      expect(dataLakeFileClientFlushSpy).toHaveBeenCalled();
    });

    it('should retry append before fail and call item error hook', async () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function(file) {
          this._queue.push({file, progress: 0, uploadedBytes: 0, isUploading: false});
        }.bind(uploader)
      );

      dataLakeFileClientAppendSpy.mockRejectedValue('error');

      uploader.addFile(getFileSpy());
      await uploader.upload();

      expect(dataLakeFileClientAppendSpy).toHaveBeenCalledTimes(5);
      expect(config.onItemError).toHaveBeenCalledTimes(1);
    });

    it('should break upload if isUploading = false', async () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function(file) {
          this._queue.push({file, progress: 0, uploadedBytes: 0, isUploading: false});
        }.bind(uploader)
      );
      jest.spyOn(uploader, 'cancel').mockImplementationOnce(
        function() {
          this._isUploading = false;
        }.bind(uploader)
      );
      dataLakeFileClientAppendSpy.mockImplementation((a, b, c, opt) => {
        opt.onProgress({loadedBytes: 1});
        return new Promise(res => setTimeout(() => res(undefined), 50));
      })

      uploader.addFile(getFileSpy('file', 2));

      const beforeMs = new Date().getTime();
      const op = uploader.upload();
      uploader.cancel();
      await op;
      const afterMs = new Date().getTime();
      expect(afterMs - beforeMs).toBeLessThan(100);
    });

    it('should not fail if hooks are not defined', async () => {
      uploader = new ADLSUploader({getItemUploadUrl: () => 'url'});
      await expect(uploader.upload()).resolves.toBe(undefined);
    });

    it('should calculate progress', async () => {
      jest.spyOn(uploader, 'addFiles').mockImplementationOnce(
        function(files) {
          this._queue.push(...files.map(file => ({file, progress: 0, uploadedBytes: 0, isUploading: false})));
          this._size = files.reduce((acc, file) => acc + file.size, 0);
        }.bind(uploader)
      );
      dataLakeFileClientAppendSpy.mockImplementation((a, b, c: number, opt: {onProgress: Function}) => {
        for (let i = 1; i <= c; i++) {
          opt.onProgress({loadedBytes: i});
        }
        return Promise.resolve();
      });
      const files = [getFileSpy('file', 3), getFileSpy('file2', 4)];
      const size = files.reduce((acc, file) => acc + file.size, 0);
      uploader.addFiles(files);

      await uploader.upload();

      expect(config.onProgress).toHaveBeenNthCalledWith(1, 1 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(2, 2 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(3, 3 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(4, 4 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(5, 5 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(6, 6 / size * 100);
      expect(config.onProgress).toHaveBeenNthCalledWith(7, 7 / size * 100);

      expect(config.onItemProgress).toHaveBeenCalledTimes(7);

      // TODO: check condition of object passed to onItemProgress hook
    });

    afterEach(() => jest.clearAllMocks());
  });

  describe('cancel method', () => {
    let uploader: ADLSUploader;
    beforeEach(() => {
      uploader = new ADLSUploader({
        getItemUploadUrl: () => 'url'
      });
    });

    it('should call abort method', () => {
      uploader.cancel();
      expect(abortSpy).toHaveBeenCalled();
    });

    it('should set isUploading to false', async () => {
      jest.spyOn(uploader, 'upload').mockImplementationOnce(
        function () {
          this._isUploading = true;
        }.bind(uploader)
      );

      await uploader.upload();
      uploader.cancel();

      expect(uploader.isUploading).toBeFalsy();
    });

    it('should set item isUploading property to false', () => {
      jest.spyOn(uploader, 'addFile').mockImplementationOnce(
        function(file) {
          this._queue.push({file, isUploading: true});
        }.bind(uploader)
      );

      uploader.addFile(getFileSpy());
      uploader.cancel();

      expect(uploader.queue[0].isUploading).toBeFalsy();
    });

    afterEach(() => jest.clearAllMocks());
  });

});

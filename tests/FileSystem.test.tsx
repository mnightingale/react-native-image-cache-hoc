import 'should'
import pathLib from 'path'
import { mockData } from './mockData'
import RNFS from 'react-native-fs'
import uuid from 'react-native-uuid'
import FileSystemFactory, { FileSystem } from '../src/FileSystem'
import { mocked } from 'ts-jest/utils'

describe('FileSystem', function () {
  const MockedRNFS = mocked(RNFS, true)

  beforeEach(function () {
    jest.clearAllMocks()
  })

  // Test static class properties and methods
  it('FileSystem class cache locking logic should work as expected.', () => {
    // Cache lock should default to empty
    FileSystem.cacheLock.should.deepEqual({})

    // Adding files to cache lock should work as expected.
    FileSystem.lockCacheFile('test-file-name.jpg', 'arbitrary-uuid-1')
    FileSystem.lockCacheFile('test-file-name.jpg', 'arbitrary-uuid-2')
    FileSystem.cacheLock.should.deepEqual({
      'test-file-name.jpg': {
        'arbitrary-uuid-1': true,
        'arbitrary-uuid-2': true,
      },
    })

    // Unlocking cache files should work as expected.
    FileSystem.unlockCacheFile('test-file-name.jpg', 'arbitrary-uuid-1')
    FileSystem.unlockCacheFile('test-file-name.jpg', 'arbitrary-uuid-2')
    FileSystem.cacheLock.should.deepEqual({})
  })

  it('#constructor should initialize object properties correctly.', () => {
    const fileSystem = FileSystemFactory()

    fileSystem.should.have.properties({
      cachePruneTriggerLimit: 15728640,
      baseFilePath: mockData.basePath + '/react-native-image-cache-hoc/',
    })
  })

  it('#_setBaseFilePath should set a base filepath correctly.', () => {
    const fileSystem = FileSystemFactory()

    fileSystem
      ._setBaseFilePath('test-file-dir-name')
      .should.equal(mockData.basePath + '/test-file-dir-name/')
  })

  it('#_validatePath should validate the file path is safe.', () => {
    const fileSystem = FileSystemFactory()

    const badPath = '../../../../badpath'

    try {
      fileSystem._validatePath(badPath)
    } catch (error) {
      const resolvedPath = pathLib.resolve(
        mockData.basePath + '/react-native-image-cache-hoc/' + badPath,
      )
      error.should.deepEqual(new Error(resolvedPath + ' is not a valid file path.'))
    }

    const goodPath = 'safe/path'

    fileSystem._validatePath(goodPath).should.be.true()
  })

  it('#exists mocked as true.', () => {
    const fileSystem = FileSystemFactory()

    return expect(fileSystem.exists('abitrary-file.jpg')).resolves.toEqual(true)
  })

  describe('getFileNameFromUrl', () => {
    it('#getFileNameFromUrl should create a sha1 filename from a PNG/JPG/GIF/BMP url.', () => {
      const fileSystem = FileSystemFactory()

      const pngFilename = fileSystem.getFileNameFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )

      pngFilename.should.equal('cd7d2199cd8e088cdfd9c99fc6359666adc36289.png')

      const gifFilename = fileSystem.getFileNameFromUrl(
        'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif',
      )

      gifFilename.should.equal('c048132247cd28c7879ab36d78a8f45194640006.gif')

      const jpgFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red.jpg',
      )

      jpgFilename.should.equal('6adf4569ecc3bf8c378bb4d47b1995cd85c5a13c.jpg')

      const bmpFilename = fileSystem.getFileNameFromUrl(
        'https://cdn-learn.adafruit.com/assets/assets/000/010/147/original/tiger.bmp',
      )

      bmpFilename.should.equal('282fb62d2caff367aff828ce21e79575733605c8.bmp')
    })

    it('#getFileNameFromUrl should handle urls with same pathname but different query strings or fragments as individual files.', () => {
      const fileSystem = FileSystemFactory()

      const pngFilename = fileSystem.getFileNameFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png?exampleparam=one&anotherparam=2#this-is-a-fragment',
      )

      pngFilename.should.equal('9eea25bf871c2333648080180f6b616a91ce1b09.png')

      const pngFilenameTwo = fileSystem.getFileNameFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png?exampleparam=DIFFERENT&anotherparam=2#this-is-a-fragment-two',
      )

      pngFilenameTwo.should.equal('09091b8880ddb982968a0fe28abed5034f9a43b8.png')
    })

    it('#getFileNameFromUrl should handle PNG/JPG/GIF/BMP urls and urls without file extensions.', () => {
      const fileSystem = FileSystemFactory()

      const pngFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red.png',
      )
      pngFilename.should.equal('b89a6739cdfd993a9b5d43b2ff4aa216e17c63ae.png')

      const jpgFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red.jpg',
      )
      jpgFilename.should.equal('6adf4569ecc3bf8c378bb4d47b1995cd85c5a13c.jpg')

      const gifFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red.gif',
      )
      gifFilename.should.equal('f0bc1d93ca75e6e355188391e3d0f1aab6d30bad.gif')

      const bmpFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red.bmp',
      )
      bmpFilename.should.equal('ca15f1856605a6a5ca1d426a12f91efdc061b31c.bmp')

      const unknownFilename = fileSystem.getFileNameFromUrl(
        'https://cdn2.hubspot.net/hub/42284/file-14233687-jpg/images/test_in_red',
      )
      unknownFilename.should.equal('831eb245a3d9032cdce450f8760d2b8ddb442a3d.bin')
    })

    it('#getLocalFilePathFromUrl should return local filepath if it exists on local fs', async () => {
      const fileSystem = FileSystemFactory()

      MockedRNFS.stat.mockResolvedValueOnce({
        name: '',
        path: '',
        size: '',
        mode: 777,
        mtime: 0,
        ctime: 0,
        originalFilepath: '',
        isFile: () => true,
        isDirectory: () => false,
      })

      const localFilePath = await fileSystem.getLocalFilePathFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )

      expect(localFilePath).toEqual(
        'file://' +
          mockData.basePath +
          '/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
      )

      expect(MockedRNFS.downloadFile).not.toBeCalled()
    })

    it('#getLocalFilePathFromUrl should download file and write to disk if it does not exist on local fs.', async () => {
      const fileSystem = FileSystemFactory()

      await expect(
        fileSystem.getLocalFilePathFromUrl(
          'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        ),
      ).resolves.toBe(
        'file:///base/file/path/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
      )

      expect(MockedRNFS.downloadFile).toBeCalled()
    })
  })

  describe('Observable', () => {
    it('When url is empty, expect null path', (done) => {
      const fileSystem = FileSystemFactory()

      fileSystem.observable('', 'arbitrary-uuid-1').subscribe((value) => {
        expect(value.path).toBeNull()
        done()
      })
    })

    it('When a immutable request is made with an existing cached file, the cached file should be used without making a download request', (done) => {
      const fileSystem = FileSystemFactory()

      MockedRNFS.stat.mockResolvedValueOnce({
        name: '',
        path: '',
        size: '',
        mode: 777,
        mtime: 0,
        ctime: 0,
        originalFilepath: '',
        isFile: () => true,
        isDirectory: () => false,
      })

      const url =
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const requestId = uuid.v4()

      FileSystem.lockCacheFile(fileName, requestId)

      const onNext = jest.fn()

      // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
      fileSystem.observable(url, requestId).subscribe({
        next: (element) => {
          onNext()
          expect(element).toStrictEqual({
            path:
              'file:///base/file/path/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
            fileName: 'cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          })
        },
      })

      setImmediate(() => {
        expect(onNext).toBeCalledTimes(1)
        expect(MockedRNFS.downloadFile).not.toHaveBeenCalled()
        FileSystem.unlockCacheFile(fileName, requestId)
        done()
      })
    })

    it('When a mutable request is made without an existing cached file, the file path should be emitted once', (done) => {
      const fileSystem = FileSystemFactory()

      const url =
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const requestId = uuid.v4()

      FileSystem.lockCacheFile(fileName, requestId)

      const onNext = jest.fn()

      // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
      fileSystem.observable(url, requestId, 'mutable').subscribe({
        next: (element) => {
          onNext()
          expect(element).toStrictEqual({
            path:
              'file:///base/file/path/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
            fileName: 'cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          })
        },
      })

      setImmediate(() => {
        expect(onNext).toBeCalledTimes(1)
        expect(MockedRNFS.downloadFile).toHaveBeenCalled()
        FileSystem.unlockCacheFile(fileName, requestId)
        done()
      })
    })

    it('When a mutable request is made with an existing cached file and the remote file has changed, the file path should be emitted twice', (done) => {
      const fileSystem = FileSystemFactory()

      MockedRNFS.stat
        // observable
        .mockResolvedValueOnce({
          name: '',
          path: '',
          size: '',
          mode: 777,
          mtime: 0,
          ctime: 0,
          originalFilepath: '',
          isFile: () => true,
          isDirectory: () => false,
        })
        // fetchFile
        .mockResolvedValueOnce({
          name: '',
          path: '',
          size: '',
          mode: 777,
          mtime: 0,
          ctime: 0,
          originalFilepath: '',
          isFile: () => true,
          isDirectory: () => false,
        })

      const url =
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const requestId = uuid.v4()

      FileSystem.lockCacheFile(fileName, requestId)

      const onNext = jest.fn()

      // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
      fileSystem.observable(url, requestId, 'mutable').subscribe({
        next: (element) => {
          onNext()
          expect(element).toStrictEqual({
            path:
              'file:///base/file/path/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
            fileName: 'cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          })
        },
      })

      setImmediate(() => {
        expect(onNext).toBeCalledTimes(2)
        expect(MockedRNFS.downloadFile).toHaveBeenCalled()
        FileSystem.unlockCacheFile(fileName, requestId)
        done()
      })
    })

    it('When a mutable request is made with an existing cached file and the remote file has not changed, the file path should be emitted once', (done) => {
      const fileSystem = FileSystemFactory()

      MockedRNFS.stat
        .mockResolvedValueOnce({
          name: '',
          path: '',
          size: '',
          mode: 777,
          mtime: 0,
          ctime: 0,
          originalFilepath: '',
          isFile: () => true,
          isDirectory: () => false,
        })
        .mockResolvedValueOnce({
          name: '',
          path: '',
          size: '',
          mode: 777,
          mtime: 0,
          ctime: 0,
          originalFilepath: '',
          isFile: () => true,
          isDirectory: () => false,
        })

      MockedRNFS.downloadFile.mockImplementationOnce(() => ({
        jobId: -1,
        promise: Promise.resolve({ jobId: -1, bytesWritten: 0, statusCode: 304 }),
      }))

      const url =
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const requestId = uuid.v4()

      FileSystem.lockCacheFile(fileName, requestId)

      const onNext = jest.fn()

      // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
      fileSystem.observable(url, requestId, 'mutable').subscribe({
        next: (element) => {
          onNext()
          expect(element).toStrictEqual({
            path:
              'file:///base/file/path/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
            fileName: 'cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          })
        },
      })

      setImmediate(() => {
        expect(onNext).toBeCalledTimes(1)
        expect(MockedRNFS.downloadFile).toHaveBeenCalled()
        FileSystem.unlockCacheFile(fileName, requestId)
        done()
      })
    })

    it('When a invalid cache strategy is provided, an error should be thrown', () => {
      const fileSystem = FileSystemFactory()

      const url =
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const requestId = uuid.v4()

      expect(() => fileSystem.observable(url, requestId, 'invalid' as any, fileName)).toThrow(
        'Invalid CacheStrategy invalid is unhandled',
      )
    })

    it('#observable should throw if a lock does not exist', () => {
      const fileSystem = FileSystemFactory()

      expect(() => fileSystem.observable('https://i.redd.it/rc29s4bz61uz.png', uuid.v4())).toThrow(
        'A lock must be aquired before requesting an observable',
      )
    })

    it('#observable should reuse existing observables', () => {
      const fileSystem = FileSystemFactory()

      const url = 'https://i.redd.it/rc29s4bz61uz.png'
      const fileName = fileSystem.getFileNameFromUrl(url)
      const componentIdA = uuid.v4()
      const componentIdB = uuid.v4()

      FileSystem.lockCacheFile(fileName, componentIdA)
      FileSystem.lockCacheFile(fileName, componentIdB)

      const a = fileSystem.observable(url, componentIdA)
      const b = fileSystem.observable(url, componentIdB)

      expect(a).toBe(b)

      FileSystem.unlockCacheFile(fileName, componentIdA)
      FileSystem.unlockCacheFile(fileName, componentIdB)
    })

    it('#observable should handle failure responses on download', (done) => {
      const fileSystem = FileSystemFactory()

      MockedRNFS.downloadFile.mockImplementationOnce(() => ({
        jobId: -1,
        promise: Promise.resolve({ jobId: -1, bytesWritten: 0, statusCode: 404 }),
      }))

      fileSystem
        .fetchFile(
          'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        )
        .subscribe(({ path }) => {
          expect(path).toBeNull()

          expect(MockedRNFS.unlink).toHaveBeenCalled()

          done()
        })
    })
  })

  describe('fetchFile', () => {
    it('#fetchFile should validate path.', () => {
      const fileSystem = FileSystemFactory()
      const badFileName = '../../../../bad-filename.jpg'
      expect(() => fileSystem.fetchFile('https://google.com/arbitrary.jpg', badFileName)).toThrow(
        (() => {
          const resolvedPath = pathLib.resolve(
            mockData.basePath + '/react-native-image-cache-hoc/' + badFileName,
          )
          return resolvedPath + ' is not a valid file path.'
        })(),
      )
    })

    it('#fetchFile prune logic should be called on cache writes.', (done) => {
      const fileSystem = FileSystemFactory()
      // Mock fileSystem.pruneCache() to determine if it is called correctly.
      fileSystem.pruneCache = jest.fn(() => Promise.resolve())
      // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
      fileSystem
        .fetchFile(
          'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        )
        .subscribe({
          complete: () => {
            expect(fileSystem.pruneCache).toHaveBeenCalled()
            done()
          },
        })
    })
  })

  describe('Cache Pruning', () => {
    it('When the cache directory exists, method should complete', async () => {
      const fileSystem = FileSystemFactory()

      await fileSystem.pruneCache()
    })

    it('When the cache directory does not exist, method should exit early', async () => {
      MockedRNFS.exists.mockResolvedValueOnce(false)

      const fileSystem = FileSystemFactory()

      await fileSystem.pruneCache()

      expect(MockedRNFS.readDir).not.toHaveBeenCalled()
    })
  })

  describe('unlink', () => {
    it('#unlink should only accept valid paths.', () => {
      const fileSystem = FileSystemFactory()

      const badFileName = '/../../../../../bad-file-name.jpg'

      return fileSystem
        .unlink(badFileName)
        .then(() => {
          throw new Error('Bad file path was accepted.')
        })
        .catch((error) => {
          const resolvedPath = pathLib.resolve(mockData.basePath + badFileName)

          error.should.deepEqual(new Error(resolvedPath + ' is not a valid file path.'))
        })
    })

    it('#unlink should work as expected for valid paths.', () => {
      // Mock unlink to be true.
      MockedRNFS.unlink.mockResolvedValueOnce()

      const fileSystem = FileSystemFactory()

      const validPath = '/valid.jpg'

      return expect(fileSystem.unlink(validPath)).resolves.toEqual(true)
    })

    it('#unlink should work as expected for invalid paths.', () => {
      // Mock unlink to be false.
      MockedRNFS.exists.mockResolvedValueOnce(false)

      const fileSystem = FileSystemFactory()

      const invalidPath = '/invalid.jpg'

      return expect(fileSystem.unlink(invalidPath)).resolves.toEqual(true)
    })
  })
})

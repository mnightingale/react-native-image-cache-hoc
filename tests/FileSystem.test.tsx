import 'should'
import FileSystemFactory, { FileSystem } from '../src/FileSystem'
import pathLib from 'path'
import { mockData } from './mockData'
import RNFS from 'react-native-fs'
import { doesNotThrow } from 'should'
import uuid from 'react-native-uuid'

describe('FileSystem', function () {
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

  it('#getLocalFilePathFromUrl should return local filepath if it exists on local fs in permanent dir.', () => {
    const fileSystem = FileSystemFactory()

    return fileSystem
      .getLocalFilePathFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )
      .then((localFilePath) => {
        localFilePath.should.equal(
          'file://' +
            mockData.basePath +
            '/react-native-image-cache-hoc/permanent/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
        )
      })
  })

  it('#getLocalFilePathFromUrl should return local filepath if it exists on local fs in cache dir.', () => {
    RNFS.exists.mockResolvedValueOnce(false) // mock not exist in local permanent dir

    const fileSystem = FileSystemFactory()

    return fileSystem
      .getLocalFilePathFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )
      .then((localFilePath) => {
        localFilePath.should.equal(
          'file://' +
            mockData.basePath +
            '/react-native-image-cache-hoc/cache/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
        )
      })
  })

  it('#getLocalFilePathFromUrl should download file and write to disk (default to cache dir) if it does not exist on local fs.', () => {
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber

    const fileSystem = FileSystemFactory()

    return fileSystem
      .getLocalFilePathFromUrl(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )
      .then((localFilePath) => {
        localFilePath.should.equal(
          'file:///base/file/path/react-native-image-cache-hoc/cache/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
        )
      })
  })

  it('#fetchFile should validate path.', () => {
    const fileSystem = FileSystemFactory()

    const badFileName = '../../../../bad-filename.jpg'

    expect(() =>
      fileSystem.fetchFile('https://google.com/arbitrary.jpg', true, badFileName),
    ).toThrow(
      (() => {
        const resolvedPath = pathLib.resolve(
          mockData.basePath + '/react-native-image-cache-hoc/permanent/' + badFileName,
        )
        return resolvedPath + ' is not a valid file path.'
      })(),
    )
  })

  it('#fetchFile clobber safeguard should work.', (done) => {
    const fileSystem = FileSystemFactory()

    // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
    fileSystem
      .fetchFile(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
      )
      .subscribe(({ path }) => {
        expect(path).toBeNull()
        done()
      })
  })

  it('#fetchFile prune logic should not be called on permanent writes.', (done) => {
    const fileSystem = FileSystemFactory()

    let pruneCacheHit = false

    // Mock fileSystem.pruneCache() to determine if it is called correctly.
    fileSystem.pruneCache = async () => {
      pruneCacheHit = true
    }

    // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
    fileSystem
      .fetchFile(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        true,
        null,
        true,
      )
      .subscribe(() => {
        pruneCacheHit.should.be.false()
        done()
      })
  })

  it('#fetchFile prune logic should be called on cache writes.', (done) => {
    const fileSystem = FileSystemFactory()

    let pruneCacheHit = false

    // Mock fileSystem.pruneCache() to determine if it is called correctly.
    fileSystem.pruneCache = async () => {
      pruneCacheHit = true
    }

    // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
    fileSystem
      .fetchFile(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        false,
        null,
        true,
      )
      .subscribe(() => {
        pruneCacheHit.should.be.true()
        done()
      })
  })

  it('#fetchFile should work as expected.', (done) => {
    const fileSystem = FileSystemFactory()

    // Mock fileSystem.pruneCache().
    fileSystem.pruneCache = async () => {}

    // fileSystem.exists() is mocked to always return true, so error should always be thrown unless clobber is set to true.
    fileSystem
      .fetchFile(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        false,
        null,
        true,
      )
      .subscribe((result) => {
        result.should.deepEqual({
          path:
            'file:///base/file/path/react-native-image-cache-hoc/cache/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          fileName: 'cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
        })
        done()
      })
  })

  it('#pruneCache should not throw errors.', () => {
    const fileSystem = FileSystemFactory()

    return fileSystem.pruneCache()
  })

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
    RNFS.unlink.mockResolvedValueOnce(true)

    const fileSystem = FileSystemFactory()

    const validPath = '/permanent/valid.jpg'

    return expect(fileSystem.unlink(validPath)).resolves.toEqual(true)
  })

  it('#unlink should work as expected for invalid paths.', () => {
    // Mock unlink to be false.
    RNFS.exists.mockResolvedValueOnce(false)

    const fileSystem = FileSystemFactory()

    const validPath = '/permanent/invalid.jpg'

    return expect(fileSystem.unlink(validPath)).resolves.toEqual(true)
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

    RNFS.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 404 }),
    })

    fileSystem
      .fetchFile(
        'https://img.wennermedia.com/5333a62d-07db-432a-92e2-198cafa38a14-326adb1a-d8ed-4a5d-b37e-5c88883e1989.png',
        false,
        null,
        true,
      )
      .subscribe(({ path }) => {
        expect(path).toBeNull()

        done()
      })
  })
})

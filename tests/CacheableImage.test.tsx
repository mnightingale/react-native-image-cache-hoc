import 'should'
import { mockData } from './mockData'
import { FileSystem, imageCacheHoc, ReactNativeImageCacheHocOptions } from '../src/index'
import { Image, Text } from 'react-native'
import 'should-sinon'
import RNFS from 'react-native-fs'
import { shallow } from 'enzyme'
import React from 'react'
import { mocked } from 'ts-jest/utils'
import { ReplaySubject } from 'rxjs'
import { CacheFileInfo } from '../src/FileSystem'

describe('CacheableImage', function () {
  const originalWarn = console.warn
  afterEach(() => (console.warn = originalWarn))
  const MockedRNFS = mocked(RNFS, true)

  beforeEach(function () {
    jest.clearAllMocks()
  })

  it('HOC options validation should work as expected.', () => {
    // Check validation is catching bad option input.

    expect(() =>
      imageCacheHoc(Image, {
        validProtocols: 'string' as any,
      }),
    ).toThrow('validProtocols option must be an array of protocol strings.')

    expect(() =>
      imageCacheHoc(Image, {
        fileHostWhitelist: 'string' as any,
      }),
    ).toThrow('fileHostWhitelist option must be an array of host strings.')

    expect(() =>
      imageCacheHoc(Image, {
        cachePruneTriggerLimit: 'string' as any,
      }),
    ).toThrow('cachePruneTriggerLimit option must be an integer.')

    expect(() =>
      imageCacheHoc(Image, {
        fileDirName: 1 as any,
      }),
    ).toThrow('fileDirName option must be string')

    expect(() =>
      imageCacheHoc(Image, {
        defaultPlaceholder: 5478329 as any,
      }),
    ).toThrow('defaultPlaceholder option must be a ReactNode')

    const validOptions: ReactNativeImageCacheHocOptions = {
      validProtocols: ['http', 'https'],
      fileHostWhitelist: ['i.redd.it', 'localhost'],
      cachePruneTriggerLimit: 1024 * 1024 * 10,
      fileDirName: 'test-dir',
      defaultPlaceholder: <Text>Default Placeholder</Text>,
    }

    // Valid options shouldn't throw an error
    const CacheableImage = imageCacheHoc(Image, validOptions)

    // Check options are set correctly on component
    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    cacheableImage.options.should.have.properties(validOptions)
  })

  it('#cacheFile static method should work as expected for cache dir files.', () => {
    const CacheableImage = imageCacheHoc(Image)

    return CacheableImage.cacheFile('https://i.redd.it/rc29s4bz61uz.png').then((result) => {
      result.should.deepEqual({
        url: 'https://i.redd.it/rc29s4bz61uz.png',
        localFilePath:
          'file:///base/file/path/react-native-image-cache-hoc/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })
    })
  })

  describe('cacheLocalFile', () => {
    it('When local file exists, it should be copied to the cache', async () => {
      const CacheableImage = imageCacheHoc(Image)

      const local = '/exists.png'
      const url = 'https://example.com/exists.png'

      const result = await CacheableImage.cacheLocalFile(local, url)

      expect(result).toStrictEqual({
        url: 'https://example.com/exists.png',
        path:
          '/base/file/path/react-native-image-cache-hoc/90c1be491d18ff2a7280039e9b65749461a65403.png',
      })

      expect(MockedRNFS.copyFile).toHaveBeenCalled()
    })

    it('When local file exists, it should be moved to the cache', async () => {
      const CacheableImage = imageCacheHoc(Image)

      const local = '/exists.png'
      const url = 'https://example.com/exists.png'

      const result = await CacheableImage.cacheLocalFile(local, url, true)

      expect(result).toStrictEqual({
        url: 'https://example.com/exists.png',
        path:
          '/base/file/path/react-native-image-cache-hoc/90c1be491d18ff2a7280039e9b65749461a65403.png',
      })

      expect(MockedRNFS.moveFile).toHaveBeenCalled()
    })

    it('When local file does not exist, no fs operation should be performed', async () => {
      MockedRNFS.exists.mockResolvedValueOnce(false)

      const CacheableImage = imageCacheHoc(Image)

      const local = '/missing.png'
      const url = 'https://example.com/missing.png'

      const result = await CacheableImage.cacheLocalFile(local, url)

      expect(result).toStrictEqual({
        url: 'https://example.com/missing.png',
        path: null,
      })

      expect(MockedRNFS.copyFile).not.toHaveBeenCalled()
      expect(MockedRNFS.moveFile).not.toHaveBeenCalled()
    })

    it('When local file and observable exist, it should be notified of changes', async (done) => {
      FileSystem.cacheObservables[
        '90c1be491d18ff2a7280039e9b65749461a65403.png'
      ] = new ReplaySubject<CacheFileInfo>(1)

      const CacheableImage = imageCacheHoc(Image)

      const local = '/exists.png'
      const url = 'https://example.com/exists.png'

      await CacheableImage.cacheLocalFile(local, url)

      FileSystem.cacheObservables['90c1be491d18ff2a7280039e9b65749461a65403.png'].subscribe(
        (value) => {
          expect(value).toStrictEqual({
            path:
              'file:///base/file/path/react-native-image-cache-hoc/90c1be491d18ff2a7280039e9b65749461a65403.png',
            fileName: '90c1be491d18ff2a7280039e9b65749461a65403.png',
          })
          done()
        },
      )
    })
  })

  it('#flush static method should work as expected.', () => {
    // Mock unlink to always be true.
    MockedRNFS.unlink.mockResolvedValueOnce()

    const CacheableImage = imageCacheHoc(Image)

    expect(CacheableImage.flush()).resolves.toBe(true)
  })

  it('#constructor should initialize class object properties correctly.', () => {
    const CacheableImage = imageCacheHoc(Image)

    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    // Ensure defaults set correctly
    cacheableImage.props.should.have.properties(mockData.mockCacheableImageProps)
    cacheableImage.state.should.have.properties({
      source: undefined,
    })
    cacheableImage.options.should.have.properties({
      validProtocols: ['https'],
      fileHostWhitelist: [],
      cachePruneTriggerLimit: 15728640,
      fileDirName: null,
      defaultPlaceholder: null,
    })
    cacheableImage.fileSystem.should.have.properties({
      cachePruneTriggerLimit: 15728640,
      baseFilePath: mockData.basePath + '/react-native-image-cache-hoc/',
    })
  })

  it('#_validateImageComponent should validate bad component props correctly.', () => {
    console.warn = jest.fn()

    // Verify source uri prop only accepts web accessible urls.

    const CacheableImage = imageCacheHoc(Image)

    new CacheableImage({
      source: {
        uri: './local-file.jpg',
      },
    })

    expect(console.warn).toHaveBeenNthCalledWith(
      1,
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    )

    // Verify source uri prop only accepts web accessible urls from whitelist if whitelist set.

    const CacheableImageWithOpts = imageCacheHoc(Image, {
      fileHostWhitelist: ['i.redd.it'],
    })

    new CacheableImageWithOpts({
      source: {
        uri:
          'https://www.google.com/logos/doodles/2017/day-of-the-dead-2017-6241959625621504-l.png',
      },
    })

    expect(console.warn).toHaveBeenNthCalledWith(
      2,
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    )

    // Verify source uri prop only accepts web accessible urls from correct protocols if protocol list set.

    const CacheableImageWithProtocolOpts = imageCacheHoc(Image, {
      validProtocols: ['http'],
    })

    new CacheableImageWithProtocolOpts({
      source: {
        uri:
          'https://www.google.com/logos/doodles/2017/day-of-the-dead-2017-6241959625621504-l.png',
      },
    })

    expect(console.warn).toHaveBeenNthCalledWith(
      3,
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    )
  })

  it('Verify component is actually still mounted before calling setState() in componentDidMount().', async () => {
    // Set up mocks
    const FileSystem = require('../src/FileSystem').default
    FileSystem.prototype.getLocalFilePathFromUrl = jest.fn()
    FileSystem.prototype.getLocalFilePathFromUrl.mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            mockData.basePath +
              '/react-native-image-cache-hoc/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          )
        }, 500) // Mock 0.5 second delay for this async function to complete.
      }),
    )

    const CacheableImage = imageCacheHoc(Image)
    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    // Ensure that if component is mounted then immediately unmounted before componentDidMount() finishes
    // executing, setState() will not be called by an unmounted component when componentDidMount() resumes execution after
    // completing async work.
    // See: https://github.com/billmalarky/react-native-image-cache-hoc/issues/6#issuecomment-354490597
    const setStateSpy = jest.spyOn(cacheableImage, 'setState')
    cacheableImage.componentDidMount()
    cacheableImage.unmounted$.value.should.be.false()
    cacheableImage.componentWillUnmount()
    cacheableImage.unmounted$.value.should.be.true()

    // Wait for componentDidMount() to complete execution.
    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })

    // Ensure that setState() was not called on unmounted component.
    expect(setStateSpy).not.toBeCalled()

    setStateSpy.mockRestore()
  })

  it('componentDidUpdate should not throw any uncaught errors.', (done) => {
    const CacheableImage = imageCacheHoc(Image)

    const wrapper = shallow(<CacheableImage {...mockData.mockCacheableImageProps} />)

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          'file:///base/file/path/react-native-image-cache-hoc/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })

      wrapper.setProps({ source: { uri: 'https://example.com/B.jpg' } })

      setImmediate(() => {
        expect(wrapper.prop('source')).toStrictEqual({
          uri:
            'file:///base/file/path/react-native-image-cache-hoc/a940ee9ea388fcea7628d9a64dfac6a698aa0228.jpg',
        })

        done()
      })
    })
  })

  it('#render with valid props does not throw an error.', (done) => {
    const CacheableImage = imageCacheHoc(Image)

    const wrapper = shallow(<CacheableImage {...mockData.mockCacheableImageProps} />)

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          'file:///base/file/path/react-native-image-cache-hoc/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })

      wrapper.setState({
        source: {
          uri: './test.jpg',
        },
      })

      expect(wrapper.prop('source')).toStrictEqual({
        uri: './test.jpg',
      })

      done()
    })
  })

  it('When render with onLoadFinished prop, event should be called with image size', (done) => {
    const CacheableImage = imageCacheHoc(Image)

    const onLoadFinished = jest.fn()

    const getSizeMock = jest
      .spyOn(Image, 'getSize')
      .mockImplementation((uri: string, success: (width: number, height: number) => void) => {
        success(100, 200)
      })

    shallow(
      <CacheableImage {...mockData.mockCacheableImageProps} onLoadFinished={onLoadFinished} />,
    )

    setImmediate(() => {
      expect(getSizeMock).toHaveBeenCalledTimes(1)
      expect(onLoadFinished).toHaveBeenCalled()

      getSizeMock.mockRestore()

      done()
    })
  })
})

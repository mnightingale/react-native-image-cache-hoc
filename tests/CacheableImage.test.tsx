import 'should'
import { mockData } from './mockData'
import { imageCacheHoc } from '../src/index'
import { Image } from 'react-native'
import sinon from 'sinon'
import 'should-sinon'
import RNFS from 'react-native-fs'
import { shallow } from 'enzyme'
import React from 'react'

describe('CacheableImage', function () {
  const originalWarn = console.warn
  afterEach(() => (console.warn = originalWarn))

  it('HOC options validation should work as expected.', () => {
    // Check validation is catching bad option input.
    try {
      imageCacheHoc(Image, {
        validProtocols: 'string',
      })
    } catch (error) {
      error.should.deepEqual(
        new Error('validProtocols option must be an array of protocol strings.'),
      )
    }

    try {
      imageCacheHoc(Image, {
        fileHostWhitelist: 'string',
      })
    } catch (error) {
      error.should.deepEqual(
        new Error('fileHostWhitelist option must be an array of host strings.'),
      )
    }

    try {
      imageCacheHoc(Image, {
        cachePruneTriggerLimit: 'string',
      })
    } catch (error) {
      error.should.deepEqual(new Error('cachePruneTriggerLimit option must be an integer.'))
    }

    try {
      imageCacheHoc(Image, {
        fileDirName: 1,
      })
    } catch (error) {
      error.should.deepEqual(new Error('fileDirName option must be string'))
    }

    try {
      imageCacheHoc(Image, {
        defaultPlaceholder: 5478329,
      })
    } catch (error) {
      error.should.deepEqual(
        new Error(
          'defaultPlaceholder option object must include "component" and "props" properties (props can be an empty object)',
        ),
      )
    }

    const validOptions = {
      validProtocols: ['http', 'https'],
      fileHostWhitelist: ['i.redd.it', 'localhost'],
      cachePruneTriggerLimit: 1024 * 1024 * 10,
      fileDirName: 'test-dir',
      defaultPlaceholder: {
        component: Image,
        props: {},
      },
    }

    // Valid options shouldn't throw an error
    const CacheableImage = imageCacheHoc(Image, validOptions)

    // Check options are set correctly on component
    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    cacheableImage.options.should.have.properties(validOptions)
  })

  it('Component property type validation should exist.', () => {
    const CacheableImage = imageCacheHoc(Image)

    // eslint-disable-next-line react/forbid-foreign-prop-types
    Object.keys(CacheableImage.propTypes).should.deepEqual([
      'fileHostWhitelist',
      'source',
      'permanent',
      'style',
      'placeholder',
      'onLoadFinished',
    ])
  })

  it('#cacheFile static method should work as expected for cache dir files.', () => {
    // Mock that file does not exist on local fs.
    RNFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    // Mock fetch result

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    })

    const CacheableImage = imageCacheHoc(Image)

    return CacheableImage.cacheFile('https://i.redd.it/rc29s4bz61uz.png').then((result) => {
      result.should.deepEqual({
        url: 'https://i.redd.it/rc29s4bz61uz.png',
        cacheType: 'cache',
        localFilePath:
          'file:///base/file/path/react-native-image-cache-hoc/cache/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })
    })
  })

  it('#cacheFile static method should work as expected for permanent dir files.', () => {
    // Mock that file does not exist on local fs.
    RNFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    // Mock fetch result
    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    })

    const CacheableImage = imageCacheHoc(Image)

    return CacheableImage.cacheFile('https://i.redd.it/rc29s4bz61uz.png', true).then((result) => {
      result.should.deepEqual({
        url: 'https://i.redd.it/rc29s4bz61uz.png',
        cacheType: 'permanent',
        localFilePath:
          'file:///base/file/path/react-native-image-cache-hoc/permanent/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })
    })
  })

  it('#flush static method should work as expected.', () => {
    // Mock unlink to always be true.
    RNFS.unlink.mockResolvedValue(true)

    const CacheableImage = imageCacheHoc(Image)

    return CacheableImage.flush().then((result) => {
      result.should.deepEqual({
        permanentDirFlushed: true,
        cacheDirFlushed: true,
      })
    })
  })

  it('#constructor should initialize class object properties correctly.', () => {
    const CacheableImage = imageCacheHoc(Image)

    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    // Ensure defaults set correctly
    cacheableImage.props.should.have.properties(mockData.mockCacheableImageProps)
    cacheableImage.state.should.have.properties({
      localFilePath: null,
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
    const consoleOutput = []
    console.warn = (output) => consoleOutput.push(output)

    // Verify source uri prop only accepts web accessible urls.

    const CacheableImage = imageCacheHoc(Image)

    new CacheableImage({
      source: {
        uri: './local-file.jpg',
      },
    })

    expect(consoleOutput).toEqual([
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    ])

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

    expect(consoleOutput).toEqual([
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    ])

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

    expect(consoleOutput).toEqual([
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
      'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
    ])
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
              '/react-native-image-cache-hoc/permanent/cd7d2199cd8e088cdfd9c99fc6359666adc36289.png',
          )
        }, 1000) // Mock 1 second delay for this async function to complete.
      }),
    )

    const CacheableImage = imageCacheHoc(Image)
    const cacheableImage = new CacheableImage(mockData.mockCacheableImageProps)

    // Ensure that if component is mounted then immediately unmounted before componentDidMount() finishes
    // executing, setState() will not be called by an unmounted component when componentDidMount() resumes execution after
    // completing async work.
    // See: https://github.com/billmalarky/react-native-image-cache-hoc/issues/6#issuecomment-354490597
    cacheableImage.setState = sinon.spy() // Mock setState with function tracker to ensure it doesn't get called on unmounted component.
    cacheableImage.componentDidMount()
    cacheableImage.unmounted$.value.should.be.false()
    cacheableImage.componentWillUnmount()
    cacheableImage.unmounted$.value.should.be.true()

    // Wait for componentDidMount() to complete execution.
    await new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })

    // Ensure that setState() was not called on unmounted component.
    cacheableImage.setState.should.not.be.called()
  })

  it('componentDidUpdate should not throw any uncaught errors.', (done) => {
    // Mock that file does not exist on local fs.
    RNFS.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    RNFS.downloadFile
      .mockReturnValueOnce({
        promise: Promise.resolve({ statusCode: 200 }),
      })
      .mockReturnValueOnce({
        promise: Promise.resolve({ statusCode: 200 }),
      })

    const CacheableImage = imageCacheHoc(Image)

    const wrapper = shallow(<CacheableImage {...mockData.mockCacheableImageProps} />)

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          'file:///base/file/path/react-native-image-cache-hoc/cache/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })

      wrapper.setProps({ source: { uri: 'https://example.com/B.jpg' } })

      setImmediate(() => {
        expect(wrapper.prop('source')).toStrictEqual({
          uri:
            'file:///base/file/path/react-native-image-cache-hoc/cache/a940ee9ea388fcea7628d9a64dfac6a698aa0228.jpg',
        })

        done()
      })
    })
  })

  it('#render with valid props does not throw an error.', (done) => {
    RNFS.exists.mockResolvedValueOnce(false) // mock not exist in local permanent dir

    const CacheableImage = imageCacheHoc(Image)

    const wrapper = shallow(<CacheableImage {...mockData.mockCacheableImageProps} />)

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          'file:///base/file/path/react-native-image-cache-hoc/cache/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })

      wrapper.setState({ localFilePath: './test.jpg' })

      expect(wrapper.prop('source')).toStrictEqual({
        uri: './test.jpg',
      })

      done()
    })
  })
})

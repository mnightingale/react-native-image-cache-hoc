import React from 'react'
import { imageCacheHoc } from '../src/index'
import { StyleSheet, Image } from 'react-native'
import { mockData } from './mockData'
import RNFS from 'react-native-fs'
import { shallow } from 'enzyme'

// Ensure component can mount successfully.
describe('CacheableImage', function () {
  it('renders correctly 1', (done) => {
    //Mock values for local/remote file request logic.
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    })

    const CacheableImage = imageCacheHoc(Image)

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
    })

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
      />,
    )

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          '/base/file/path/react-native-image-cache-hoc/cache/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })
      done()
    })
  })

  it('renders correctly with placeholder prop set', () => {
    //Mock values for local/remote file request logic.
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    })

    const CacheableImage = imageCacheHoc(Image)

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
      placeholderImage: {
        backgroundColor: '#00ffff',
        height: 204,
        width: 150,
      },
    })

    const propPlaceholder = {
      component: Image,
      props: {
        style: styles.propPlaceholder,
      },
    }

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
        placeholder={propPlaceholder}
      />,
      { disableLifecycleMethods: true },
    )
    expect(wrapper.prop('style')).toBe(propPlaceholder.props.style)
  })

  it('renders correctly with placeholder option set', () => {
    //Mock values for local/remote file request logic.
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    })

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
      optionPlaceholder: {
        backgroundColor: '#dc143c',
        height: 204,
        width: 150,
      },
    })

    const optionPlaceholder = {
      component: Image,
      props: {
        style: styles.optionPlaceholder,
      },
    }

    const CacheableImage = imageCacheHoc(Image, {
      defaultPlaceholder: optionPlaceholder,
    })

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
      />,
      { disableLifecycleMethods: true },
    )
    expect(wrapper.prop('style')).toBe(optionPlaceholder.props.style)
  })
})

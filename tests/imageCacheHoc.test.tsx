import React from 'react'
import { imageCacheHoc } from '../src/index'
import { StyleSheet, Image, Text } from 'react-native'
import { mockData } from './mockData'
import { shallow } from 'enzyme'

// Ensure component can mount successfully.
describe('CacheableImage', function () {
  beforeEach(function () {
    jest.clearAllMocks()
  })

  it('renders correctly 1', (done) => {
    const CacheableImage = imageCacheHoc(Image)

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
    })

    const wrapper = shallow(
      <CacheableImage style={styles.image} source={mockData.mockCacheableImageProps.source} />,
    )

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri:
          'file:///base/file/path/react-native-image-cache-hoc/d3b74e9fa8248a5805e2dcf17a8577acd28c089b.png',
      })
      done()
    })
  })

  it('renders correctly with placeholder prop set', () => {
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

    const propPlaceholder = <Text>Default Placeholder</Text>

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        placeholder={propPlaceholder}
      />,
      { disableLifecycleMethods: true },
    )
    expect(wrapper.prop('style')).toBe(propPlaceholder.props.style)
  })

  it('renders correctly with placeholder option set', () => {
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

    const optionPlaceholder = <Text>Default Placeholder</Text>

    const CacheableImage = imageCacheHoc(Image, {
      defaultPlaceholder: optionPlaceholder,
    })

    const wrapper = shallow(
      <CacheableImage style={styles.image} source={mockData.mockCacheableImageProps.source} />,
      { disableLifecycleMethods: true },
    )
    expect(wrapper.prop('style')).toBe(optionPlaceholder.props.style)
  })
})

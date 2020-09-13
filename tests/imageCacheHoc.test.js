// Define globals for eslint.
/* global expect describe it */

// Load dependencies
import React from 'react';
import imageCacheHoc from '../src/imageCacheHoc';
import { StyleSheet, Image } from 'react-native';
import { mockData } from './mockData';
import RNFetchBlob from 'rn-fetch-blob';
import { shallow } from 'enzyme';

// Ensure component can mount successfully.
describe('CacheableImage', function () {
  it('renders correctly 1', (done) => {
    //Mock values for local/remote file request logic.
    RNFetchBlob.fs.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFetchBlob.fetch.mockResolvedValue({
      path: () => {
        return '/this/is/path/to/file.jpg';
      },
    });

    const CacheableImage = imageCacheHoc(Image);

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
    });

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
      />
    );

    setImmediate(() => {
      expect(wrapper.prop('source')).toStrictEqual({
        uri: '/this/is/path/to/file.jpg',
      });
      done();
    });
  });

  it('renders correctly with placeholder prop set', () => {
    //Mock values for local/remote file request logic.
    RNFetchBlob.fs.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFetchBlob.fetch.mockResolvedValue({
      path: () => {
        return '/this/is/path/to/file.jpg';
      },
    });

    const CacheableImage = imageCacheHoc(Image);

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
      // eslint-disable-next-line react-native/no-color-literals
      placeholderImage: {
        backgroundColor: '#00ffff',
        height: 204,
        width: 150,
      },
    });

    const propPlaceholder = {
      component: Image,
      props: {
        style: styles.propPlaceholder,
      },
    };

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
        placeholder={propPlaceholder}
      />,
      { disableLifecycleMethods: true }
    );
    expect(wrapper.prop('style')).toBe(propPlaceholder.props.style);
  });

  it('renders correctly with placeholder option set', () => {
    //Mock values for local/remote file request logic.
    RNFetchBlob.fs.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFetchBlob.fetch.mockResolvedValue({
      path: () => {
        return '/this/is/path/to/file.jpg';
      },
    });

    const styles = StyleSheet.create({
      image: {
        height: 204,
        width: 150,
      },
      // eslint-disable-next-line react-native/no-color-literals
      optionPlaceholder: {
        backgroundColor: '#dc143c',
        height: 204,
        width: 150,
      },
    });

    const optionPlaceholder = {
      component: Image,
      props: {
        style: styles.optionPlaceholder,
      },
    };

    const CacheableImage = imageCacheHoc(Image, {
      defaultPlaceholder: optionPlaceholder,
    });

    const wrapper = shallow(
      <CacheableImage
        style={styles.image}
        source={mockData.mockCacheableImageProps.source}
        permanent={mockData.mockCacheableImageProps.permanent}
      />,
      { disableLifecycleMethods: true }
    );
    expect(wrapper.prop('style')).toBe(optionPlaceholder.props.style);
  });
});

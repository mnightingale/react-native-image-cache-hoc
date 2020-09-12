// Define globals for eslint.
/* global describe it */
/* global expect */

// Load dependencies
import should from 'should'; // eslint-disable-line no-unused-vars
import React from 'react';
import 'react-native';
import imageCacheHoc from '../lib/imageCacheHoc';
import { StyleSheet, View, Text, Image } from 'react-native';
import { mockData } from './mockData';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

// Ensure component can mount successfully.
describe('CacheableImage', function () {
  it('renders correctly', () => {
    //Mock values for local/remote file request logic.
    const RNFS = require('react-native-fs');
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const CacheableImage = imageCacheHoc(Image);

    const styles = StyleSheet.create({
      container: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      },
      image: {
        height: 204,
        width: 150,
      },
      welcome: {
        fontSize: 20,
        margin: 10,
        textAlign: 'center',
      },
    });

    const tree = renderer.create(
      <View style={styles.container}>
        <Text style={styles.welcome}>Test CacheableImage Component</Text>
        <CacheableImage
          style={styles.image}
          source={mockData.mockCacheableImageProps.source}
          permanent={mockData.mockCacheableImageProps.permanent}
        />
      </View>
    );
    expect(tree).toMatchSnapshot(); //If UI changes, this snapshot must be updated. See comment below.

    /**
     The next time you run the tests, the rendered output will be compared to the previously created snapshot.
     The snapshot should be committed along code changes. When a snapshot test fails, you need to inspect whether it is an intended or unintended change.
     If the change is expected you can invoke Jest with npm test -- -u to overwrite the existing snapshot.
     */
  });

  it('renders correctly with placeholder prop set', () => {
    //Mock values for local/remote file request logic.
    const RNFS = require('react-native-fs');
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const CacheableImage = imageCacheHoc(Image);

    const styles = StyleSheet.create({
      container: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      },
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
      welcome: {
        fontSize: 20,
        margin: 10,
        textAlign: 'center',
      },
    });

    const propPlaceholder = {
      component: Image,
      props: {
        style: styles.propPlaceholder,
      },
    };

    const tree = renderer.create(
      <View style={styles.container}>
        <Text style={styles.welcome}>Test CacheableImage Component</Text>
        <CacheableImage
          style={styles.image}
          source={mockData.mockCacheableImageProps.source}
          permanent={mockData.mockCacheableImageProps.permanent}
          placeholder={propPlaceholder}
        />
      </View>
    );
    expect(tree).toMatchSnapshot(); //If UI changes, this snapshot must be updated. See comment below.

    /**
     The next time you run the tests, the rendered output will be compared to the previously created snapshot.
     The snapshot should be committed along code changes. When a snapshot test fails, you need to inspect whether it is an intended or unintended change.
     If the change is expected you can invoke Jest with npm test -- -u to overwrite the existing snapshot.
     */
  });

  it('renders correctly with placeholder option set', () => {
    //Mock values for local/remote file request logic.
    const RNFS = require('react-native-fs');
    RNFS.exists
      .mockResolvedValueOnce(false) // mock not exist in local permanent dir
      .mockResolvedValueOnce(false) // mock not exist in local cache dir
      .mockResolvedValueOnce(false) // mock does not exist to get past clobber
      .mockResolvedValue(true);

    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const styles = StyleSheet.create({
      container: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      },
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
      welcome: {
        fontSize: 20,
        margin: 10,
        textAlign: 'center',
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

    const tree = renderer.create(
      <View style={styles.container}>
        <Text style={styles.welcome}>Test CacheableImage Component</Text>
        <CacheableImage
          style={styles.image}
          source={mockData.mockCacheableImageProps.source}
          permanent={mockData.mockCacheableImageProps.permanent}
        />
      </View>
    );
    expect(tree).toMatchSnapshot(); //If UI changes, this snapshot must be updated. See comment below.

    /**
     The next time you run the tests, the rendered output will be compared to the previously created snapshot.
     The snapshot should be committed along code changes. When a snapshot test fails, you need to inspect whether it is an intended or unintended change.
     If the change is expected you can invoke Jest with npm test -- -u to overwrite the existing snapshot.
     */
  });
});

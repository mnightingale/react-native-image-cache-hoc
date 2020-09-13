/**
 *
 * Mocked objects for testing.
 *
 */

/* global jest */
import * as ReactNative from 'react-native';

/**
 * Override native modules with mocks where necessary.
 */
jest.doMock('react-native', () => {
  return Object.setPrototypeOf(
    {
      Platform: {
        ...ReactNative.Platform,
        OS: 'ios',
        isTesting: true,
        select: (objs) => objs['ios'],
      },
    },
    ReactNative
  );
});

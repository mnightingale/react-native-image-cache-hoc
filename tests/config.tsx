import Adapter from 'enzyme-adapter-react-16'
import Enzyme from 'enzyme'

Enzyme.configure({ adapter: new Adapter() })

/**
 * Override native modules with mocks where necessary.
 */
jest.doMock('react-native', () => {
  const ReactNative = jest.requireActual('react-native')
  return Object.setPrototypeOf(
    {
      Platform: {
        ...ReactNative.Platform,
        OS: 'ios',
        isTesting: true,
        select: (objs: { [x: string]: any }) => objs['ios'],
      },
    },
    ReactNative,
  )
})

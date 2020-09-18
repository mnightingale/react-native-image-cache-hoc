/**
 *
 * This HOC adds the following functionality to react native <Image> components:
 *
 * - File caching. Images will be downloaded to a cache on the local file system.
 *   Cache is maintained until cache size meets a certain threshold at which point the oldest
 *   cached files are purged to make room for fresh files.
 *
 *  - File persistence. Images will be stored indefinitely on local file system.
 *    Required for images that are related to issues that have been downloaded for offline use.
 *
 * More info: https://facebook.github.io/react/docs/higher-order-components.html
 *
 */

// Load dependencies.
import React from 'react'
import PropTypes from 'prop-types'
import FileSystemFactory, { CacheFileInfo, FileSystem } from './FileSystem'
import traverse from 'traverse'
import validator from 'validator'
import uuid from 'react-native-uuid'
import { Image, ImageStyle, StyleProp } from 'react-native'
import { BehaviorSubject, Subscription } from 'rxjs'
import { skip, takeUntil } from 'rxjs/operators'

export type Source = {
  uri?: string
}

export interface OnLoadEvent {
  width: number
  height: number
}

export interface ReactNativeImageCacheHocProps {
  source?: Source
  permanent?: boolean
  onLoadFinished?(event: OnLoadEvent): void

  style?: StyleProp<ImageStyle>

  placeholder?: { component: React.ComponentType; props: any }
}

export interface ReactNativeImageCacheHocState {
  localFilePath: string | null
}

export interface ReactNativeImageCacheHocOptions {
  validProtocols?: string[]
  fileHostWhitelist?: string[]
  cachePruneTriggerLimit?: number // Maximum size of image file cache in bytes before pruning occurs. Defaults to 15 MB.
  fileDirName?: string | null // Namespace local file writing to this directory. Defaults to 'react-native-image-cache-hoc'.
  defaultPlaceholder?: {
    component: React.ComponentType
    props: any
  } | null
}

const imageCacheHoc = <P extends object>(
  Wrapped: React.ComponentType<P>,
  options: ReactNativeImageCacheHocOptions = {},
) => {
  // Validate options
  if (options.validProtocols && !Array.isArray(options.validProtocols)) {
    throw new Error('validProtocols option must be an array of protocol strings.')
  }
  if (options.fileHostWhitelist && !Array.isArray(options.fileHostWhitelist)) {
    throw new Error('fileHostWhitelist option must be an array of host strings.')
  }
  if (options.cachePruneTriggerLimit && !Number.isInteger(options.cachePruneTriggerLimit)) {
    throw new Error('cachePruneTriggerLimit option must be an integer.')
  }
  if (options.fileDirName && typeof options.fileDirName !== 'string') {
    throw new Error('fileDirName option must be string')
  }
  if (
    options.defaultPlaceholder &&
    (!options.defaultPlaceholder.component || !options.defaultPlaceholder.props)
  ) {
    throw new Error(
      'defaultPlaceholder option object must include "component" and "props" properties (props can be an empty object)',
    )
  }

  return class extends React.PureComponent<
    P & ReactNativeImageCacheHocProps,
    ReactNativeImageCacheHocState
  > {
    static propTypes = {
      fileHostWhitelist: PropTypes.array,
      source: PropTypes.object.isRequired,
      permanent: PropTypes.bool,
      style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
      placeholder: PropTypes.shape({
        component: PropTypes.func,
        props: PropTypes.object,
      }),
      onLoadFinished: PropTypes.func,
    }

    componentId: any
    unmounted$: BehaviorSubject<boolean>
    options: Required<ReactNativeImageCacheHocOptions>
    fileSystem: FileSystem
    subscription?: Subscription
    invalidUrl: boolean

    /**
     *
     * Manually cache a file.
     * Can be used to pre-warm caches.
     * If calling this method repeatedly to cache a long list of files,
     * be sure to use a queue and limit concurrency so your app performance does not suffer.
     *
     * @param url {String} - url of file to download.
     * @param permanent {Boolean} - whether the file should be saved to the tmp or permanent cache directory.
     * @returns {Promise} promise that resolves to an object that contains cached file info.
     */
    static async cacheFile(url: string, permanent = false) {
      const fileSystem = FileSystemFactory(
        options.cachePruneTriggerLimit || null,
        options.fileDirName || null,
      )
      const localFilePath = await fileSystem.getLocalFilePathFromUrl(url, permanent)

      return {
        url: url,
        cacheType: permanent ? 'permanent' : 'cache',
        localFilePath,
      }
    }

    /**
     *
     * Manually move or copy a file to the cache.
     * Can be used to pre-warm caches.
     * If calling this method repeatedly to cache a long list of files,
     * be sure to use a queue and limit concurrency so your app performance does not suffer.
     *
     * @param local {String} - path to the local file.
     * @param url {String} - url of file to download.
     * @param permanent {Boolean} - whether the file should be saved to the tmp or permanent cache directory.
     * @param move {Boolean} - whether the file should be copied or moved.
     * @returns {Promise} promise that resolves to an object that contains cached file info.
     */
    static async cacheLocalFile(local: string, url: string, permanent = false, move = false) {
      const fileSystem = FileSystemFactory(
        options.cachePruneTriggerLimit || null,
        options.fileDirName || null,
      )
      return fileSystem.cacheLocalFile(local, url, permanent, move)
    }

    /**
     *
     * Delete all locally stored image files created by react-native-image-cache-hoc (cache AND permanent).
     * Calling this method will cause a performance hit on your app until the local files are rebuilt.
     *
     * @returns {Promise} promise that resolves to an object that contains the flush results.
     */
    static async flush() {
      const fileSystem = FileSystemFactory(
        options.cachePruneTriggerLimit || null,
        options.fileDirName || null,
      )
      const [permanentDirFlushed, cacheDirFlushed] = await Promise.all([
        fileSystem.unlink('permanent'),
        fileSystem.unlink('cache'),
      ])

      return {
        permanentDirFlushed,
        cacheDirFlushed,
      }
    }

    constructor(props: P) {
      super(props)

      // Set initial state
      this.state = {
        localFilePath: null,
      }

      // Assign component unique ID for cache locking.
      this.componentId = uuid.v4()

      // Track component mount status to avoid calling setState() on unmounted component.
      this.unmounted$ = new BehaviorSubject<boolean>(true)

      // Set default options
      this.options = {
        validProtocols: options.validProtocols || ['https'],
        fileHostWhitelist: options.fileHostWhitelist || [],
        cachePruneTriggerLimit: options.cachePruneTriggerLimit || 1024 * 1024 * 15, // Maximum size of image file cache in bytes before pruning occurs. Defaults to 15 MB.
        fileDirName: options.fileDirName || null, // Namespace local file writing to this directory. Defaults to 'react-native-image-cache-hoc'.
        defaultPlaceholder: options.defaultPlaceholder || null, // Default placeholder component to render while remote image file is downloading. Can be overridden with placeholder prop. Defaults to <Image> component with style prop passed through.
      }

      // Init file system lib
      this.fileSystem = FileSystemFactory(
        this.options.cachePruneTriggerLimit,
        this.options.fileDirName,
      )

      // Validate input
      this.invalidUrl = !this._validateImageComponent()
    }

    _validateImageComponent() {
      // Define validator options
      const validatorUrlOptions: validator.IsURLOptions = {
        protocols: this.options.validProtocols,
        // eslint-disable-next-line @typescript-eslint/camelcase
        require_protocol: true,
      }
      if (this.options.fileHostWhitelist.length) {
        // eslint-disable-next-line @typescript-eslint/camelcase
        validatorUrlOptions.host_whitelist = this.options.fileHostWhitelist
      }

      // Validate source prop to be a valid web accessible url.
      if (
        !traverse(this.props).get(['source', 'uri']) ||
        !validator.isURL(traverse(this.props).get(['source', 'uri']), validatorUrlOptions)
      ) {
        console.warn(
          'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
        )
        return false
      } else {
        return true
      }
    }

    // Async calls to local FS or network should occur here.
    // See: https://reactjs.org/docs/react-component.html#componentdidmount
    componentDidMount() {
      // Track component mount status to avoid calling setState() on unmounted component.
      this.unmounted$.next(false)

      // Set url from source prop
      const url = traverse(this.props).get(['source', 'uri'])
      const permanent = this.props.permanent ? true : false

      // Add a cache lock to file with this name (prevents concurrent <CacheableImage> components from pruning a file with this name from cache).
      const fileName = this.fileSystem.getFileNameFromUrl(url)
      FileSystem.lockCacheFile(fileName, this.componentId)

      // Init the image cache logic
      if (!this.invalidUrl) {
        this.subscription = this.fileSystem
          .observable(url, this.componentId, permanent)
          .pipe(takeUntil(this.unmounted$.pipe(skip(1))))
          .subscribe((info) => this.onSourceLoaded(info))
      }
    }

    /**
     *
     * Enables caching logic to work if component source prop is updated (that is, the image url changes without mounting a new component).
     * See: https://github.com/billmalarky/react-native-image-cache-hoc/pull/15
     *
     * @param prevProps {Object} - Previous props.
     */
    componentDidUpdate(prevProps: ReactNativeImageCacheHocProps) {
      // Set urls from source prop data
      const url = traverse(prevProps).get(['source', 'uri'])
      const nextUrl = traverse(this.props).get(['source', 'uri'])

      // Do nothing if url has not changed.
      if (url === nextUrl) return

      // Remove component cache lock on old image file, and add cache lock to new image file.
      const fileName = this.fileSystem.getFileNameFromUrl(url)
      const nextFileName = this.fileSystem.getFileNameFromUrl(nextUrl)

      FileSystem.unlockCacheFile(fileName, this.componentId)
      FileSystem.lockCacheFile(nextFileName, this.componentId)

      this.invalidUrl = !this._validateImageComponent()
      const permanent = this.props.permanent ? true : false

      // Init the image cache logic
      this.subscription?.unsubscribe()
      if (!this.invalidUrl) {
        this.subscription = this.fileSystem
          .observable(nextUrl, this.componentId, permanent)
          .pipe(takeUntil(this.unmounted$.pipe(skip(1))))
          .subscribe((info) => this.onSourceLoaded(info))
      }
    }

    componentWillUnmount() {
      // Track component mount status to avoid calling setState() on unmounted component.
      this.unmounted$.next(true)

      // Remove component cache lock on associated image file on component teardown.
      const fileName = this.fileSystem.getFileNameFromUrl(
        traverse(this.props).get(['source', 'uri']),
      )
      FileSystem.unlockCacheFile(fileName, this.componentId)
    }

    onSourceLoaded({ path }: CacheFileInfo) {
      this.setState({ localFilePath: path })
      this.invalidUrl = path === null

      if (path && this.props.onLoadFinished) {
        Image.getSize(path, (width, height) => {
          if (!this.unmounted$.value && this.props.onLoadFinished) {
            this.props.onLoadFinished({ width, height })
          }
        })
      }
    }

    render() {
      // If media loaded, render full image component, else render placeholder.
      if (this.state.localFilePath && !this.invalidUrl) {
        // Extract props proprietary to this HOC before passing props through.
        const { permanent, ...filteredProps } = this.props

        const props = Object.assign({}, filteredProps, {
          source: { uri: this.state.localFilePath },
        })
        return <Wrapped {...(props as P)} />
      } else {
        if (this.props.placeholder) {
          return <this.props.placeholder.component {...this.props.placeholder.props} />
        } else if (this.options.defaultPlaceholder) {
          return (
            <this.options.defaultPlaceholder.component {...this.options.defaultPlaceholder.props} />
          )
        } else {
          // Extract props proprietary to this HOC before passing props through.
          const { permanent, source, ...filteredProps } = this.props

          return <Wrapped {...(filteredProps as P)} />
        }
      }
    }
  }
}

export { imageCacheHoc, FileSystem, FileSystemFactory }

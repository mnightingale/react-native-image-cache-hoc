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
import React, { ReactNode } from 'react'
import FileSystemFactory, { CacheFileInfo, FileSystem } from './FileSystem'
import traverse from 'traverse'
import validator from 'validator'
import uuid from 'react-native-uuid'
import { Image, ImageStyle, Platform, StyleProp } from 'react-native'
import { BehaviorSubject, Subscription } from 'rxjs'
import { skip, takeUntil } from 'rxjs/operators'
import URL from 'url-parse'

export type CacheStrategy = 'immutable' | 'mutable'

export type Source = {
  uri?: string
  cache?: CacheStrategy
}

export interface OnLoadEvent {
  width: number
  height: number
}

export interface ReactNativeImageCacheHocProps {
  source?: Source
  onLoadFinished?(event: OnLoadEvent): void
  style?: StyleProp<ImageStyle>
  placeholder?: ReactNode
  fileHostWhitelist?: string[]
}

interface ReactNativeImageCacheHocState {
  source?: {
    uri?: string
  }
}

export interface ReactNativeImageCacheHocOptions {
  validProtocols?: string[]
  fileHostWhitelist?: string[]
  cachePruneTriggerLimit?: number // Maximum size of image file cache in bytes before pruning occurs. Defaults to 15 MB.
  fileDirName?: string | null // Namespace local file writing to this directory. Defaults to 'react-native-image-cache-hoc'.
  defaultPlaceholder?: ReactNode | null
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
  if (options.defaultPlaceholder && typeof options.defaultPlaceholder !== 'object') {
    throw new Error('defaultPlaceholder option must be a ReactNode')
  }

  return class extends React.PureComponent<
    P & ReactNativeImageCacheHocProps,
    ReactNativeImageCacheHocState
  > {
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
     * @returns {Promise} promise that resolves to an object that contains cached file info.
     */
    static async cacheFile(url: string): Promise<any> {
      const localFilePath = await this.fileSystem().getLocalFilePathFromUrl(url)

      return {
        url: url,
        localFilePath,
      }
    }

    /**
     *
     * Manually move or copy a local file to the cache.
     * Can be used to pre-warm caches.
     * If calling this method repeatedly to cache a long list of files,
     * be sure to use a queue and limit concurrency so your app performance does not suffer.
     *
     * @param local {String} - path to the local file.
     * @param url {String} - url of file to download.
     * @param move {Boolean} - whether the file should be copied or moved.
     * @param mtime {Date} - creation timestamp
     * @param ctime {Date} - modification timestamp (iOS only)
     * @returns {Promise} promise that resolves to an object that contains cached file info.
     */
    static async cacheLocalFile(
      local: string,
      url: string,
      move = false,
      mtime?: Date,
      ctime?: Date,
    ) {
      return this.fileSystem().cacheLocalFile(local, url, move, mtime, ctime)
    }

    /**
     *
     * Delete all locally stored image files created by react-native-image-cache-hoc.
     * Calling this method will cause a performance hit on your app until the local files are rebuilt.
     *
     * @returns {Promise} promise that resolves to an object that contains the flush results.
     */
    static async flush() {
      return this.fileSystem().unlink('')
    }

    /**
     *  Export FileSystem for convenience.
     *
     * @returns {FileSystem}
     */
    static fileSystem() {
      return FileSystemFactory(options.cachePruneTriggerLimit || null, options.fileDirName || null)
    }

    constructor(props: P) {
      super(props)

      // Set initial state
      this.state = {
        source: undefined,
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
      const cacheStrategy = traverse(this.props).get(['source', 'cache']) || 'immutable'
      const isFile = url && new URL(url).protocol === 'file:'

      if (isFile || !this.invalidUrl) {
        if (isFile) {
          this.onSourceLoaded({
            path: url,
            fileName: this.fileSystem.getFileNameFromUrl(url),
          })
        } else {
          // Add a cache lock to file with this name (prevents concurrent <CacheableImage> components from pruning a file with this name from cache).
          const fileName = this.fileSystem.getFileNameFromUrl(url)
          FileSystem.lockCacheFile(fileName, this.componentId)

          // Init the image cache logic
          this.subscription = this.fileSystem
            .observable(url, this.componentId, cacheStrategy)
            .pipe(takeUntil(this.unmounted$.pipe(skip(1))))
            .subscribe((info) => this.onSourceLoaded(info))
        }
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
      const isFile = nextUrl && new URL(nextUrl).protocol === 'file:'

      // Do nothing if url has not changed.
      if (url === nextUrl) return

      // Remove component cache lock on old image file, and add cache lock to new image file.
      const fileName = this.fileSystem.getFileNameFromUrl(url)
      const cacheStrategy = traverse(this.props).get(['source', 'cache']) || 'immutable'

      FileSystem.unlockCacheFile(fileName, this.componentId)
      this.subscription?.unsubscribe()

      this.invalidUrl = !this._validateImageComponent()

      // Init the image cache logic
      if (isFile || !this.invalidUrl) {
        if (isFile) {
          this.onSourceLoaded({
            path: nextUrl,
            fileName: this.fileSystem.getFileNameFromUrl(nextUrl),
          })
        } else {
          // Add a cache lock to file with this name (prevents concurrent <CacheableImage> components from pruning a file with this name from cache).
          const nextFileName = this.fileSystem.getFileNameFromUrl(nextUrl)
          FileSystem.lockCacheFile(nextFileName, this.componentId)

          this.subscription = this.fileSystem
            .observable(nextUrl, this.componentId, cacheStrategy)
            .pipe(takeUntil(this.unmounted$.pipe(skip(1))))
            .subscribe((info) => this.onSourceLoaded(info))
        }
      } else {
        this.setState({ source: undefined })
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
      this.setState({
        source: path
          ? {
              uri: path + (Platform.OS === 'android' ? '?' + Date.now() : ''),
            }
          : undefined,
      })
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
      if (this.state.source) {
        // Android caches images in memory, if we are rendering the image should have changed locally so appending a timestamp to the path forces it to be loaded from disk
        // The internals of te Android behaviour have not been investigated but perhaps it would be beneficial to use the last modified date instead
        const props = {
          ...this.props,
          source: this.state.source,
        }

        return <Wrapped key={this.componentId} {...(props as P)} />
      } else {
        if (this.props.placeholder) {
          return this.props.placeholder
        } else if (this.options.defaultPlaceholder) {
          return this.options.defaultPlaceholder
        } else {
          // Extract props proprietary to this HOC before passing props through.
          const { source, ...filteredProps } = this.props

          return <Wrapped {...(filteredProps as P)} />
        }
      }
    }
  }
}

export { imageCacheHoc, FileSystem, FileSystemFactory }

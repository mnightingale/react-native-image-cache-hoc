/**
 *
 * This library acts as an interface to abstract the OS file system and is platform independent.
 *
 * File paths passed into this library should be relative, as the base file path is different
 * across platforms, and therefore is automatically set by this library.
 *
 */

import { Platform } from 'react-native'
import pathLib from 'path'
import RNFS from 'react-native-fs'
import sha1 from 'crypto-js/sha1'
import URL from 'url-parse'
import { from, Observable, of, ReplaySubject } from 'rxjs'
import {
  switchMap,
  catchError,
  mapTo,
  publishReplay,
  refCount,
  mergeMap,
  map,
  filter,
  delayWhen,
  concatAll,
  take,
} from 'rxjs/operators'
import uuid from 'react-native-uuid'
import { CacheStrategy } from '.'

export interface CacheFileInfo {
  path: string | null
  fileName: string
}

/**
 * Resolves if 'unlink' resolves or if the file doesn't exist.
 *
 * @param {string} filename
 */
const RNFSUnlinkIfExists = (filename: string) =>
  RNFS.exists(filename).then((exists) => {
    if (exists) {
      return RNFS.unlink(filename)
    }
    return Promise.resolve()
  })

export class FileSystem {
  /**
   * All FileSystem instances will reference the cacheLock singleton "dictionary" to provide cache file locking in order to prevent concurrency race condition bugs.
   *
   * cacheLock structure:
   *
   * cacheLock = {
   *   'filename.jpg': {
   *     'componentIdOne': true,
   *     'componentIdTwo': true
   *   }
   * }
   *
   * In the above example cache/filename.jpg cannot be deleted during cache pruning,
   * until both components release their locks on the dependant image file.
   *
   * One example (of many) of how a race condition could occur:
   *
   * 1st <CacheableImage> mounts and downloads image file into cache, calls render() (or not) etc.
   * 2nd <CacheableImage> mounts concurrently and during download runs pruneCache(), deleting 1st <CacheableImage>'s image file from cache.
   * 1st <CacheableImage> calls render() again at some point in the future, at this time it's image file no longer exists so the render fails.
   */
  static cacheLock: {
    [key: string]: {
      [component: string]: boolean
    }
  } = {}
  static cacheObservables: {
    [key: string]: ReplaySubject<CacheFileInfo>
  } = {}
  baseFilePath: string
  cachePruneTriggerLimit: number

  static lockCacheFile(fileName: string, componentId: string) {
    // If file is already locked, add additional component lock, else create initial file lock.
    if (FileSystem.cacheLock[fileName]) {
      FileSystem.cacheLock[fileName][componentId] = true
    } else {
      const componentDict: { [component: string]: boolean } = {}
      componentDict[componentId] = true
      FileSystem.cacheLock[fileName] = componentDict
    }
  }

  static unlockCacheFile(fileName: string, componentId: string) {
    // Delete component lock on cache file
    if (FileSystem.cacheLock[fileName]) {
      delete FileSystem.cacheLock[fileName][componentId]

      // If no further component locks remain on cache file, delete filename property from cacheLock dictionary.
      if (Object.keys(FileSystem.cacheLock[fileName]).length === 0) {
        delete FileSystem.cacheLock[fileName]

        if (FileSystem.cacheObservables[fileName]) {
          delete FileSystem.cacheObservables[fileName]
        }
      }
    }
  }

  constructor(cachePruneTriggerLimit: number | null, fileDirName: string | null) {
    this.cachePruneTriggerLimit = cachePruneTriggerLimit || 1024 * 1024 * 15 // Maximum size of image file cache in bytes before pruning occurs. Defaults to 15 MB.
    fileDirName = fileDirName || 'react-native-image-cache-hoc' // Namespace local file writing to this folder.
    this.baseFilePath = this._setBaseFilePath(fileDirName)
  }

  /**
   *
   * Sets the base file directory depending on platform. Prefix is used to avoid local file collisions.
   *
   * Apple:
   * Apple requires non-user generated files to be stored in cache dir, they can be flagged to persist. https://developer.apple.com/icloud/documentation/data-storage/index.html
   * it appears reactNativeFetchBlob will flag these files to persist behind the scenes, so cache dir is safe on apple. See: https://www.npmjs.com/package/rn-fetch-blob#cache-file-management
   *
   * Android:
   * Android appears to purge cache dir files so we should use document dir to play it safe (even with reactNativeFetchBlob abstraction) : https://developer.android.com/guide/topics/data/data-storage.html
   *
   * @returns {String} baseFilePath - base path that files are written to in local fs.
   * @private
   */
  _setBaseFilePath(fileDirName?: string) {
    let baseFilePath = Platform.OS === 'ios' ? RNFS.CachesDirectoryPath : RNFS.DocumentDirectoryPath
    baseFilePath += '/' + fileDirName + '/'
    return baseFilePath
  }

  /**
   *
   * Pseudo-chroot paths to the baseFilePath set in _setBaseFilePath().
   *
   * This method should be called on any passed in path to prevent writing to invalid directories.
   * IE passing in a path of '../../../../../home/should/not/write/here/file.png' to break out of
   * the base file path directory.
   *
   * @param path {String} - local fs path.
   * @param absolute {String} - whether or not the passed in path is absolute or relative. Defaults to relative since base path differs across platforms.
   * @returns {boolean} - Whether or not the file path is valid.
   * @throws error on bad filepath.
   * @private
   */
  _validatePath(path: string, absolute = false) {
    const relative = pathLib.relative(this.baseFilePath, absolute ? path : this.baseFilePath + path)
    if (path !== '' && (!relative || relative.startsWith('..') || pathLib.isAbsolute(relative))) {
      // resolve turns any path into an absolute path (ie: /folder1/folder2/../example.js resolves to /folder1/example.js)
      const resolvedPath = absolute
        ? pathLib.resolve(path)
        : pathLib.resolve(this.baseFilePath + path)
      throw new Error(resolvedPath + ' is not a valid file path.')
    } else {
      return true
    }
  }

  /**
   *
   * Wrapper for https://github.com/joltup/rn-fetch-blob/wiki/File-System-Access-API#existspathstringpromise
   *
   * @param path - local relative file path.
   * @returns {Promise} - boolean promise for if file exists at path or not.
   */
  exists(path: string) {
    this._validatePath(path)
    return RNFS.exists(pathLib.resolve(this.baseFilePath + path))
  }

  /**
   *
   * Creates a SHA1 hash filename from a url and normalizes extension.
   *
   * @param url {String} - An absolute url.
   * @throws error on invalid (non jpg, png, gif, bmp) url file type. NOTE file extension or content-type header does not guarantee file mime type. We are trusting that it is set correctly on the server side.
   * @returns fileName {string} - A SHA1 filename that is unique to the resource located at passed in URL and includes an appropriate extension.
   */
  getFileNameFromUrl(url: string) {
    const urlParts = new URL(url)
    const urlExt = urlParts.pathname.split('.').pop()

    // react-native enforces Image src to default to a file extension of png
    const extension = urlExt === urlParts.pathname ? 'bin' : urlExt

    return sha1(url).toString() + '.' + extension
  }

  /**
   *
   * Convenience method used to get the associated local file path of a web image that has been written to disk.
   * If the local file does not exist yet, the remote file is downloaded to local disk then the local filepath is returned.
   *
   * @param url {String} - url of file to download.
   * @returns {Promise<string|null>} promise that resolves to the local file path of downloaded url file.
   */
  async getLocalFilePathFromUrl(url: string) {
    const fileName = this.getFileNameFromUrl(url)
    const requestId = uuid.v4()

    try {
      FileSystem.lockCacheFile(fileName, requestId)

      const { path } = await this.observable(url, requestId, 'immutable', fileName)
        .pipe(take(1))
        .toPromise()

      return path
    } finally {
      FileSystem.unlockCacheFile(fileName, requestId)
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
  async cacheLocalFile(local: string, url: string, move = false, mtime?: Date, ctime?: Date) {
    const fileName = this.getFileNameFromUrl(url)
    const path = this.baseFilePath + fileName
    this._validatePath(path, true)

    if (!(await RNFS.exists(local))) {
      return {
        url,
        path: null,
      }
    }

    // Logic here prunes cache directory on "cache" writes to ensure cache doesn't get too large.
    await this.pruneCache()

    // Move or copy the file to the cache
    try {
      const cacheDirExists = await this.exists('')
      if (!cacheDirExists) {
        await RNFS.mkdir(this.baseFilePath)
      }

      await RNFSUnlinkIfExists(path)
      await (move ? RNFS.moveFile(local, path) : RNFS.copyFile(local, path))

      // Update the modified and created times of the file otherwise the if-modified-since request will probably always
      await RNFS.touch(path, mtime, ctime)
    } catch (error) {
      await RNFSUnlinkIfExists(path)
      return {
        url,
        path: null,
      }
    }

    // Publish to subscribers that the image for this url has been updated
    if (FileSystem.cacheObservables[fileName]) {
      FileSystem.cacheObservables[fileName].next({
        path: 'file://' + path,
        fileName,
      })
    }

    return {
      url,
      path,
    }
  }

  /**
   *
   * Used to download files to local filesystem.
   *
   * @param url {String} - url of file to download.
   * @param fileName {String} - defaults to a sha1 hash of the url param with extension of same filetype.
   * @returns {Observable<CacheFileInfo>} observable that resolves to an object that contains the local path of the downloaded file and the filename.
   */
  fetchFile(
    url: string,
    fileName: string | null = null,
    headers?: { [key: string]: string },
  ): Observable<CacheFileInfo> {
    fileName = fileName || this.getFileNameFromUrl(url)
    const path = this.baseFilePath + fileName
    this._validatePath(path, true)

    return from(this.exists('')).pipe(
      delayWhen((cacheDirExists) =>
        // Logic here prunes cache directory on "cache" writes to ensure cache doesn't get too large.
        from(cacheDirExists ? this.pruneCache() : RNFS.mkdir(this.baseFilePath)),
      ),
      mergeMap(() => from(RNFS.stat(path)).pipe(catchError(() => of(null)))),
      // Hit network and download file to local disk.
      mergeMap((stat) =>
        from(
          RNFS.downloadFile({
            fromUrl: url,
            toFile: path,
            headers,
          }).promise,
        ).pipe(
          // Only need to emit or throw errors if the file has changed or this is the first download
          filter((downloadResult) => stat === null || downloadResult.statusCode === 200),
          map((downloadResult) => {
            if (stat === null && downloadResult.statusCode !== 200) {
              throw new Error('Request failed ' + downloadResult.statusCode)
            }

            return {
              path: 'file://' + path,
              fileName: pathLib.basename(path),
            }
          }),
        ),
      ),
      catchError(() =>
        from(RNFSUnlinkIfExists(path)).pipe(
          mapTo({
            path: null,
            fileName: pathLib.basename(path),
          }),
        ),
      ),
    )
  }

  /**
   * Used to remove files from cache directory if the cache grows too large.
   * This function will delete files from the cache until the total cache size
   * is less than FileSystem.cachePruneTriggerLimit setting.
   *
   * @returns {Promise}
   */
  async pruneCache() {
    // If cache directory does not exist yet there's no need for pruning.
    if (!(await this.exists(''))) {
      return
    }

    // Get directory contents
    const dirContents = await RNFS.readDir(this.baseFilePath)

    // Sort dirContents in order of oldest to newest file.
    dirContents.sort((a, b) => {
      return (a.mtime?.getTime() ?? 0) - (b.mtime?.getTime() ?? 0)
    })

    const currentCacheSize = dirContents.reduce((cacheSize, blobStatObject) => {
      return cacheSize + parseInt(blobStatObject.size)
    }, 0)

    // Prune cache if current cache size is too big.
    if (currentCacheSize > this.cachePruneTriggerLimit) {
      let overflowSize = currentCacheSize - this.cachePruneTriggerLimit

      const unlinkPromises = []

      // Keep deleting cached files so long as the current cache size is larger than the size required to trigger cache pruning, or until
      // all cache files have been evaluated.
      while (overflowSize > 0 && dirContents.length) {
        const contentFile = dirContents.shift()

        // Only prune unlocked files from cache
        if (
          contentFile &&
          !FileSystem.cacheLock[contentFile.name] &&
          this._validatePath(contentFile.name)
        ) {
          overflowSize -= parseInt(contentFile.size)
          unlinkPromises.push(RNFSUnlinkIfExists(this.baseFilePath + contentFile.name))
        }
      }

      await Promise.all(unlinkPromises)
    }
  }

  /**
   * Used to delete local files and directories
   *
   * @param path - local relative file path.
   * @returns {Promise} - boolean promise for if deletion was successful.
   */
  async unlink(path: string) {
    this._validatePath(path)

    try {
      await RNFSUnlinkIfExists(pathLib.resolve(this.baseFilePath + path))

      const obs$ = FileSystem.cacheObservables[path]
      if (obs$) {
        obs$.next({
          path: null,
          fileName: path,
        })
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Gets a observable which emits when a url is resolved to a local file path
   * A cache lock is required @see {lockCacheFile}
   *
   * @param url {String} - url of file to download.
   * @param componentId {String} - Unique id of the requestor.
   * @param cacheStrategy {CacheStrategy} - The cache strategy to use, defaults to 'immutable'.
   * @param fileName {String} - defaults to a sha1 hash of the url param with extension of same filetype.
   * @returns {Observable<CacheFileInfo>} observable that resolves to an object that contains the local path of the downloaded file and the filename.
   */
  observable(
    url: string,
    componentId: string,
    cacheStrategy: CacheStrategy = 'immutable',
    fileName: string | null = null,
  ): Observable<CacheFileInfo> {
    if (!url) {
      return of({
        path: null,
        fileName: '',
      })
    }

    // Check for invalid cache strategies
    if (cacheStrategy !== 'immutable' && cacheStrategy !== 'mutable') {
      throw new Error(`Invalid CacheStrategy ${cacheStrategy} is unhandled`)
    }

    fileName = fileName || this.getFileNameFromUrl(url)

    if (!FileSystem.cacheLock[fileName] || !FileSystem.cacheLock[fileName][componentId]) {
      throw new Error('A lock must be aquired before requesting an observable')
    }

    if (!FileSystem.cacheObservables[fileName]) {
      this._validatePath(fileName)

      const subject$ = new ReplaySubject<CacheFileInfo>()

      const obs$ = from(RNFS.stat(this.baseFilePath + fileName)).pipe(
        catchError(() => of(null)),
        switchMap((stat) => {
          if (stat !== null) {
            switch (cacheStrategy) {
              case 'immutable': {
                return of({
                  path: 'file://' + this.baseFilePath + fileName,
                  fileName,
                } as CacheFileInfo)
              }
              case 'mutable': {
                return from([
                  of({
                    path: 'file://' + this.baseFilePath + fileName,
                    fileName,
                  } as CacheFileInfo),
                  this.fetchFile(url, fileName, {
                    'if-modified-since': new Date(stat.mtime).toUTCString(),
                  }),
                ]).pipe(concatAll())
              }
            }
          }

          // Download
          return this.fetchFile(url, fileName)
        }),
        publishReplay(1),
        refCount(),
      )

      // Subscribe
      obs$.subscribe((v) => subject$.next(v))

      return (FileSystem.cacheObservables[fileName] = subject$)
    }

    return FileSystem.cacheObservables[fileName]
  }
}

/**
 *  Export FileSystem factory for convenience.
 *
 * @returns {FileSystem}
 */
export default function FileSystemFactory(
  cachePruneTriggerLimit?: number | null,
  fileDirName?: string | null,
): FileSystem {
  return new FileSystem(cachePruneTriggerLimit || null, fileDirName || null)
}

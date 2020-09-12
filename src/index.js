/**
 * Bootstrap.
 *
 * @module imageCacheHoc
 */

'use strict';

import imageCacheHoc from './imageCacheHoc';
import FileSystemFactory, { FileSystem } from './FileSystem';

export default imageCacheHoc;
export { FileSystemFactory, FileSystem }; // Allow access to FS logic for advanced users.

/* global jest */
const { mockData } = require('../mockData');

module.exports = {
  mkdir: jest.fn(),
  moveFile: jest.fn(),
  copyFile: jest.fn(),
  pathForBundle: jest.fn(),
  pathForGroup: jest.fn(),
  getFSInfo: jest.fn(),
  getAllExternalFilesDirs: jest.fn(),
  unlink: jest.fn(),
  exists: jest.fn(),
  stopDownload: jest.fn(),
  resumeDownload: jest.fn(),
  isResumable: jest.fn(),
  stopUpload: jest.fn(),
  completeHandlerIOS: jest.fn(),
  readDir: jest.fn().mockResolvedValue([
    {
      ctime: new Date(1508878829000),
      mtime: new Date(1508878829000),
      name: '0fbbfec764c73ee5b4e3a0cb8861469bc9fc6c8c.jpg',
      path: mockData.basePath + '/cache/0fbbfec764c73ee5b4e3a0cb8861469bc9fc6c8c.jpg',
      size: '43663',
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      ctime: new Date(1508877930000),
      mtime: new Date(1508877930000),
      name: '6865fd0a65771b0044319f562873cc7b145abb4a.jpg',
      path: mockData.basePath + '/cache/6865fd0a65771b0044319f562873cc7b145abb4a.jpg',
      size: '9000000',
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      ctime: new Date(1508877698000),
      mtime: new Date(1508877698000),
      name: 'b003269c377af6a2f53f59bc127a06c86f54312b.jpg',
      path: mockData.basePath + '/cache/b003269c377af6a2f53f59bc127a06c86f54312b.jpg',
      size: '14133330',
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      ctime: new Date(1508877954000),
      mtime: new Date(1508877954000),
      name: 'd1052b9f22c1f00f4d658224f4295307b97db69f.jpg',
      path: mockData.basePath + '/cache/d1052b9f22c1f00f4d658224f4295307b97db69f.jpg',
      size: '1684',
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      ctime: new Date(1509634852000),
      mtime: new Date(1509634852000),
      name: 'faf4e58257d988ea6eab23aee5e5733bff9b2a9e.jpg',
      path: mockData.basePath + '/cache/faf4e58257d988ea6eab23aee5e5733bff9b2a9e.jpg',
      size: '65769',
      isFile: () => true,
      isDirectory: () => false,
    },
  ]),
  readDirAssets: jest.fn(),
  existsAssets: jest.fn(),
  readdir: jest.fn(),
  setReadable: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  read: jest.fn(),
  readFileAssets: jest.fn(),
  hash: jest.fn(),
  copyFileAssets: jest.fn(),
  copyFileAssetsIOS: jest.fn(),
  copyAssetsVideoIOS: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  write: jest.fn(),
  downloadFile: jest.fn(),
  uploadFiles: jest.fn(),
  touch: jest.fn(),
  MainBundlePath: jest.fn(),
  CachesDirectoryPath: mockData.basePath,
  DocumentDirectoryPath: mockData.basePath,
  ExternalDirectoryPath: jest.fn(),
  ExternalStorageDirectoryPath: jest.fn(),
  TemporaryDirectoryPath: jest.fn(),
  LibraryDirectoryPath: jest.fn(),
  PicturesDirectoryPath: jest.fn(),
};

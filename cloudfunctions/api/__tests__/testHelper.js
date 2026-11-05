/**
 * 测试助手 — 每个测试前重置 mock 数据库
 * 在需要数据库的测试文件中 require 此文件
 */
const cloud = require('wx-server-sdk');

beforeEach(() => {
  cloud.__resetStores();
  cloud.__setOpenid(null);
});

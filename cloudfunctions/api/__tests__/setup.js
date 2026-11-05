/**
 * 测试设置 — 每个测试前重置 mock 数据库
 */
const cloud = require('wx-server-sdk');

beforeEach(() => {
  cloud.__resetStores();
  cloud.__setOpenid(null);
});

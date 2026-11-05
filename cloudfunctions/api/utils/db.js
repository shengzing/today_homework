/**
 * 数据库连接封装 — 统一 db 和 _（command）引用
 * 文档引用：后端服务设计 §4.1 目录结构
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

module.exports = { db, _, cloud };

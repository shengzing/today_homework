/**
 * 统一错误码 — 后端服务设计 §4.4
 *
 * code  | HTTP | 含义
 * ------|------|------
 * 0     | 200  | 成功
 * 40000 | 400  | 未知接口
 * 40001 | 400  | 参数缺失或非法
 * 40100 | 401  | 未获取到微信身份
 * 40101 | 401  | 未登录（openid 在 users 中不存在）
 * 40301 | 403  | 不是班级成员
 * 40302 | 403  | 权限不足（非管理员）
 * 40303 | 403  | 不是该作业的发布者
 * 40401 | 404  | 资源不存在
 * 40901 | 409  | 邀请码无效或已失效
 * 40902 | 409  | 已是班级成员（幂等返回成功）
 * 50000 | 500  | 服务异常
 */

const CODES = {
  OK: '0',
  UNKNOWN_ACTION: '40000',
  PARAM_INVALID: '40001',
  NO_WX_IDENTITY: '40100',
  NOT_LOGGED_IN: '40101',
  NOT_MEMBER: '40301',
  NOT_OWNER: '40302',
  NOT_CREATOR: '40303',
  NOT_FOUND: '40401',
  INVITE_INVALID: '40901',
  ALREADY_MEMBER: '40902',
  SERVER_ERROR: '50000'
};

const MESSAGES = {
  '0': 'ok',
  '40000': '未知接口',
  '40001': '参数缺失或非法',
  '40100': '未获取到微信身份',
  '40101': '请先完成授权登录',
  '40301': '你不在该班级中',
  '40302': '只有管理员可以执行此操作',
  '40303': '只有发布者可以执行此操作',
  '40401': '资源不存在',
  '40901': '邀请码无效或已失效',
  '40902': '已是班级成员',
  '50000': '服务异常，请稍后再试'
};

function fail(code, message) {
  return {
    code: code,
    message: message || MESSAGES[code] || '未知错误',
    data: null
  };
}

function ok(data) {
  return { code: CODES.OK, message: 'ok', data };
}

/**
 * 业务错误对象（带 bizCode 字段，供 index.js catch 捕获）
 */
class BizError extends Error {
  constructor(bizCode, message) {
    super(message || MESSAGES[bizCode] || '业务错误');
    this.bizCode = bizCode;
    this.name = 'BizError';
  }
}

function bizError(code, message) {
  return new BizError(code, message);
}

module.exports = { CODES, MESSAGES, fail, ok, BizError, bizError };

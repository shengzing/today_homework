/**
 * utils/errcode 测试
 */
const { fail, ok, bizError, BizError, CODES, MESSAGES } = require('../../utils/errcode');

describe('utils/errcode', () => {
  test('ok() 返回正确结构', () => {
    const r = ok({ foo: 1 });
    expect(r.code).toBe('0');
    expect(r.message).toBe('ok');
    expect(r.data).toEqual({ foo: 1 });
  });

  test('fail() 返回正确结构', () => {
    const r = fail(CODES.NOT_MEMBER, '你不在该班级中');
    expect(r.code).toBe(CODES.NOT_MEMBER);
    expect(r.message).toBe('你不在该班级中');
    expect(r.data).toBeNull();
  });

  test('fail() 无 message 时用默认文案', () => {
    const r = fail(CODES.NOT_FOUND);
    expect(r.message).toBe(MESSAGES[CODES.NOT_FOUND]);
  });

  test('bizError() 返回 BizError 实例', () => {
    const e = bizError(CODES.PARAM_INVALID, '测试');
    expect(e).toBeInstanceOf(BizError);
    expect(e.bizCode).toBe(CODES.PARAM_INVALID);
    expect(e.message).toBe('测试');
  });

  test('bizError() 无 message 时用默认文案', () => {
    const e = bizError(CODES.NOT_MEMBER);
    expect(e.message).toBe(MESSAGES[CODES.NOT_MEMBER]);
  });

  test('全部 11 个错误码存在', () => {
    const expected = ['0','40000','40001','40100','40101','40301','40302','40303','40401','40901','40902','50000'];
    Object.values(CODES).forEach(code => {
      expect(expected).toContain(code);
      expect(MESSAGES[code]).toBeTruthy();
    });
  });
});

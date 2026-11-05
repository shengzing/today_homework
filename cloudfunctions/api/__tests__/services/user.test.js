/**
require("../testHelper");

 * services/user 测试
 */
const { login, updateNickname } = require('../../services/user');
const cloud = require('wx-server-sdk');
const db = cloud.database();

async function setupCtx(openid) {
  cloud.__setOpenid(openid);
  // 先创建用户
  if (openid) {
    const existing = await db.collection('users').where({ openid }).get();
    if (!existing.data.length) {
      await db.collection('users').add({
        data: { openid, nickname: '小明', avatarColor: '#FF6B6B', createdAt: new Date() }
      });
    }
  }
  return require('../../utils/auth').buildContext();
}

describe('services/user', () => {
  describe('login', () => {
    test('首次登录 → isNew = true', async () => {
      cloud.__setOpenid('openid_newuser');
      const ctx = { openid: 'openid_newuser', userId: '', nickname: '' };

      const res = await login({ nickname: '小红', avatarColor: '#4ECDC4' }, ctx);
      expect(res.isNew).toBe(true);
      expect(res.nickname).toBe('小红');
      expect(res.avatarColor).toBe('#4ECDC4');
      expect(res.userId).toBeTruthy();
    });

    test('二次登录 → isNew = false，返回同一 userId', async () => {
      cloud.__setOpenid('openid_002');
      const ctx1 = { openid: 'openid_002' };
      const res1 = await login({ nickname: '小刚' }, ctx1);

      // 再次登录
      const ctx2 = { openid: 'openid_002' };
      const res2 = await login({}, ctx2);

      expect(res2.isNew).toBe(false);
      expect(res2.userId).toBe(res1.userId);
      expect(res2.nickname).toBe('小刚'); // 保持原名
    });

    test('登录时传新昵称 → 更新昵称', async () => {
      cloud.__setOpenid('openid_003');
      const ctx1 = { openid: 'openid_003' };
      await login({ nickname: '旧名' }, ctx1);

      const ctx2 = { openid: 'openid_003' };
      const res2 = await login({ nickname: '新名' }, ctx2);
      expect(res2.nickname).toBe('新名');
    });

    test('无昵称 → 默认微信用户', async () => {
      cloud.__setOpenid('openid_004');
      const ctx = { openid: 'openid_004' };
      const res = await login({}, ctx);
      expect(res.nickname).toBe('微信用户');
    });
  });

  describe('updateNickname', () => {
    test('正常修改', async () => {
      const ctx = await setupCtx('openid_010');
      const res = await updateNickname({ nickname: '新昵称' }, ctx);
      expect(res.nickname).toBe('新昵称');
    });

    test('超长昵称 → 40001', async () => {
      const ctx = await setupCtx('openid_011');
      await expect(updateNickname({ nickname: 'a'.repeat(13) }, ctx)).rejects.toThrow();
    });
  });
});

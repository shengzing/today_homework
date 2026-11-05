/**
 * wx-server-sdk mock — 内存数据库模拟
 * 支持 collection().where().get()/add()/update()/remove()/count()/orderBy()/limit()
 * 支持 command: eq/neq/gte/gt/lte/lt/in/nin/inc
 */
const _stores = {};

function getStore(name) {
  if (!_stores[name]) _stores[name] = [];
  return _stores[name];
}

function _match(doc, query) {
  if (!query) return true;
  for (const key of Object.keys(query)) {
    const cond = query[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      // 检查是否是 command 对象
      if (cond.__cmd) {
        const val = doc[key];
        switch (cond.__cmd) {
          case 'eq': if (val !== cond.value) return false; break;
          case 'neq': if (val === cond.value) return false; break;
          case 'gte': if (!(val >= cond.value)) return false; break;
          case 'gt': if (!(val > cond.value)) return false; break;
          case 'lte': if (!(val <= cond.value)) return false; break;
          case 'lt': if (!(val < cond.value)) return false; break;
          case 'in': if (!cond.value.includes(val)) return false; break;
          case 'nin': if (cond.value.includes(val)) return false; break;
          case 'inc': break; // inc 在 update 时处理，where 中不出现
          default: break;
        }
      } else {
        // 普通对象做深层比较
        if (JSON.stringify(doc[key]) !== JSON.stringify(cond)) return false;
      }
    } else {
      if (doc[key] !== cond) return false;
    }
  }
  return true;
}

const _ = {
  eq: (v) => ({ __cmd: 'eq', value: v }),
  neq: (v) => ({ __cmd: 'neq', value: v }),
  gte: (v) => ({ __cmd: 'gte', value: v }),
  gt: (v) => ({ __cmd: 'gt', value: v }),
  lte: (v) => ({ __cmd: 'lte', value: v }),
  lt: (v) => ({ __cmd: 'lt', value: v }),
  in: (v) => ({ __cmd: 'in', value: v }),
  nin: (v) => ({ __cmd: 'nin', value: v }),
  inc: (v) => ({ __cmd: 'inc', value: v }),
  and: (...args) => ({ __cmd: 'and', value: args }),
  or: (...args) => ({ __cmd: 'or', value: args })
};

let _seq = 1;
function _genId() {
  return 'id_' + (_seq++).toString(36) + '_' + Date.now().toString(36);
}

function _applyUpdate(doc, data) {
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val && typeof val === 'object' && val.__cmd === 'inc') {
      doc[key] = (doc[key] || 0) + val.value;
    } else {
      doc[key] = val;
    }
  }
}

function collection(name) {
  const store = getStore(name);

  function buildChain(query, opts) {
    opts = opts || {};
    const chain = {
      _q: query,
      _limit: opts.limit || null,
      _order: opts.order || null,
      _orderDir: opts.orderDir || 'asc',

      where(q) { return buildChain({ ...query, ...q }, opts); },
      limit(n) { return buildChain(query, { ...opts, limit: n }); },
      orderBy(field, dir) { return buildChain(query, { ...opts, order: field, orderDir: dir || 'asc' }); },

      _filter() {
        let results = store.filter(d => _match(d, query));
        if (opts.order) {
          results.sort((a, b) => {
            const av = a[opts.order], bv = b[opts.order];
            if (av < bv) return opts.orderDir === 'asc' ? -1 : 1;
            if (av > bv) return opts.orderDir === 'asc' ? 1 : -1;
            return 0;
          });
        }
        if (opts.limit !== null) results = results.slice(0, opts.limit);
        return results;
      },

      async get() { return { data: chain._filter() }; },
      async count() { return { total: chain._filter().length }; },

      async update({ data }) {
        let updated = 0;
        store.forEach(d => {
          if (_match(d, query)) { _applyUpdate(d, data); updated++; }
        });
        return { stats: { updated } };
      },

      async remove() {
        let removed = 0;
        for (let i = store.length - 1; i >= 0; i--) {
          if (_match(store[i], query)) { store.splice(i, 1); removed++; }
        }
        return { stats: { removed } };
      },

      doc(id) {
        return {
          async get() {
            const d = store.find(d => d._id === id);
            return { data: d ? { ...d } : null };
          },
          async set({ data }) {
            const idx = store.findIndex(d => d._id === id);
            const doc = { ...data, _id: id };
            if (idx >= 0) store[idx] = doc; else store.push(doc);
            return { stats: { updated: 1 } };
          },
          async update({ data }) {
            const idx = store.findIndex(d => d._id === id);
            if (idx >= 0) { _applyUpdate(store[idx], data); return { stats: { updated: 1 } }; }
            return { stats: { updated: 0 } };
          },
          async remove() {
            const idx = store.findIndex(d => d._id === id);
            if (idx >= 0) { store.splice(idx, 1); return { stats: { removed: 1 } }; }
            return { stats: { removed: 0 } };
          }
        };
      },

      async add({ data }) {
        const doc = { ...data, _id: data._id || _genId() };
        store.push(doc);
        return { _id: doc._id };
      }
    };
    return chain;
  }

  const root = buildChain(null);
  root.doc = function(id) {
    return {
      async get() {
        const d = store.find(d => d._id === id);
        return { data: d ? { ...d } : null };
      },
      async set({ data }) {
        const idx = store.findIndex(d => d._id === id);
        const doc = { ...data, _id: id };
        if (idx >= 0) store[idx] = doc; else store.push(doc);
        return { stats: { updated: 1 } };
      },
      async update({ data }) {
        const idx = store.findIndex(d => d._id === id);
        if (idx >= 0) { _applyUpdate(store[idx], data); return { stats: { updated: 1 } }; }
        return { stats: { updated: 0 } };
      },
      async remove() {
        const idx = store.findIndex(d => d._id === id);
        if (idx >= 0) { store.splice(idx, 1); return { stats: { removed: 1 } }; }
        return { stats: { removed: 0 } };
      }
    };
  };
  root.add = async function({ data }) {
    const doc = { ...data, _id: data._id || _genId() };
    store.push(doc);
    return { _id: doc._id };
  };
  return root;
}

const cloud = {
  DYNAMIC_CURRENT_ENV: '__dynamic__',
  init() {},
  database() {
    return { collection, command: _, _stores };
  },
  getWXContext() {
    return { OPENID: _testOpenid || 'test_openid_001' };
  },
  callFunction() {
    return Promise.resolve({ result: { code: 0 } });
  }
};

let _testOpenid = null;
cloud.__setOpenid = (id) => { _testOpenid = id; };
cloud.__resetStores = () => {
  for (const k of Object.keys(_stores)) delete _stores[k];
  _seq = 1;
};

module.exports = cloud;

/* DIBS Photo Mode: saving. IndexedDB holds the autosave, named scenes and the photo roll.
   If the browser blocks storage (private window), everything keeps working for the session. */
(function () {
  'use strict';
  var DP = window.DP = window.DP || {};
  var DB = 'dibs-photo-mode', VER = 1;
  var dbp = null, mem = { scenes: {}, roll: {}, auto: {} }, broken = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        if (!window.indexedDB) { broken = true; return res(null); }
        var rq = indexedDB.open(DB, VER);
        rq.onupgradeneeded = function () {
          var d = rq.result;
          if (!d.objectStoreNames.contains('scenes')) d.createObjectStore('scenes', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('roll')) d.createObjectStore('roll', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('auto')) d.createObjectStore('auto', { keyPath: 'id' });
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { broken = true; res(null); };
        rq.onblocked = function () { broken = true; res(null); };
      } catch (e) { broken = true; res(null); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (res, rej) {
        try {
          var t = db.transaction(store, mode), os = t.objectStore(store);
          var out = fn(os);
          t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
          t.onerror = t.onabort = function () { rej(t.error); };
        } catch (e) { rej(e); }
      });
    }).catch(function () { return undefined; });
  }
  var S = DP.Store = {};
  S.ok = function () { return open().then(function () { return !broken; }); };
  S.put = function (store, val) {
    return tx(store, 'readwrite', function (os) { if (!os) { mem[store][val.id] = val; return null; } return os.put(val); });
  };
  S.get = function (store, id) {
    return open().then(function (db) {
      if (!db) return mem[store][id];
      return new Promise(function (res) { try { var r = db.transaction(store).objectStore(store).get(id); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(undefined); }; } catch (e) { res(undefined); } });
    });
  };
  S.all = function (store) {
    return open().then(function (db) {
      if (!db) return Object.keys(mem[store]).map(function (k) { return mem[store][k]; });
      return new Promise(function (res) { try { var r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { res([]); }; } catch (e) { res([]); } });
    });
  };
  S.del = function (store, id) {
    return tx(store, 'readwrite', function (os) { if (!os) { delete mem[store][id]; return null; } return os.delete(id); });
  };
})();

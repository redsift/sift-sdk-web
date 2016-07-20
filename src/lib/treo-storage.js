/**
 * Redsift SDK. Storage module.
 * Based on APIs from https://github.com/CrowdProcess/riak-pb
 *
 * Copyright (c) 2015 Redsift Limited. All rights reserved.
 */
'use strict';
/*****************************************************************
 * Module
 *****************************************************************/
/* globals window, IDBKeyRange, Promise, self, define */
var TreoStorage = function (dbInfo, internalUse, log) {

  // dbInfo: {type: 'SYNC' | 'MSG' | 'SIFT', siftGuid: guid, accountGuid: guid, schema: schema }

  // Email msg buckets
  var EMAIL_ID_BUCKET = '_email.id';
  var EMAIL_TID_BUCKET = '_email.tid';

  var SPECIAL_BUCKETS = ['_id.list', '_tid.list', EMAIL_ID_BUCKET, EMAIL_TID_BUCKET];

  var SYNC_DB_PREFIX = 'rs_sync_log';
  var SYNC_DB_SCHEMA = [{ name: 'events', indexes: ['value.sift.guid']}, { name: 'admin' }];

  var MSG_DB_PREFIX = 'rs_msg_db';
  var MSG_DB_VERSIONED_SCHEMA = [
    // version 1
    [{name: '_id.list', indexes: ['sift.guid']}, {name: '_tid.list', indexes: ['sift.guid']}],
    // version 2
    [{name: EMAIL_ID_BUCKET, indexes: ['sift.guid']}, {name: EMAIL_TID_BUCKET, indexes: ['sift.guid']}, {name: '_id.list', drop: true}, {name: '_tid.list', drop: true}]
  ];

  // siftDb required buckets
  var USER_BUCKET = '_user.default';
  var REDSIFT_BUCKET = '_redsift';

  // Treo.js
  var treo = require('treo');
  // Main db
  var _db;
  // Msg db for _email.id and _email.tid (in case this is a sift db)
  var _msgDb;

  var _siftGuid;
  var _accountGuid;

  // If no loglevel provided, use console instead
  if(!log) {
    log = console;
  }

  /*****************************************************************
   * Internal Operations
   *****************************************************************/
  // Batch deletion supports numeric keys
  function _batchDelete(db, bucket, vals) {
    log.trace('storage: _batchDelete: ', bucket, vals);
    return new Promise(function (resolve, reject) {
      var keys = vals;
      db.transaction('readwrite', [bucket], function(err, tr) {
        if (err) { return reject(err); }
        var store = tr.objectStore(bucket);
        var current = 0;
        tr.onerror = tr.onabort = reject;
        tr.oncomplete = function oncomplete() { resolve(); };
        next();

        function next() {
          if (current >= keys.length) { return; }
          var currentKey = keys[current];
          var req;
          req = store.delete(currentKey);
          req.onerror = reject;
          req.onsuccess = next;
          current += 1;
        }
      });
    });
  }

  function _batchPut(db, bucket, kvs) {
    log.trace('storage: _batchPut: ', db, bucket, kvs);
    return new Promise(function (resolve, reject) {
      var count = kvs.length;
      db.transaction('readwrite', [bucket], function(err, tr) {
        if (err) { return reject(err); }
        var store = tr.objectStore(bucket);
        var current = 0;
        tr.onerror = tr.onabort = reject;
        tr.oncomplete = function oncomplete() { resolve(); };
        next();

        function next() {
          if (current >= count) { return; }
          log.trace('storage: _batchPut: put: ', kvs[current]);
          var req;
          req = store.put(kvs[current].value, kvs[current].key);
          req.onerror = reject;
          req.onsuccess = next;
          current += 1;
        }
      });
    });
  }

  function _getWithIndexRange(db, bucket, keys, index, range) {
    log.trace('storage: _getWithIndexRange: ', bucket, keys);
    return new Promise(function (resolve, reject) {
      var store = db.store(bucket);
      var result = [];
      var found = 0;
      keys.forEach(function (k) {
        result.push({key: k, value: undefined});
      });
      store.cursor({ index: index, range: range, iterator: iterator }, done);

      function iterator(cursor) {
        var ki = keys.indexOf(cursor.primaryKey);
        if (ki !== -1) {
          log.trace('storage: found key: ', cursor.primaryKey);
          result[ki].value = cursor.value.value;
          found++;
        }
        if(found === keys.length) {
          return done();
        }
        cursor.continue();
      }

      function done(err) {
        log.trace('storage: _getWithIndexRange: result: ', result);
        err ? reject(err) : resolve(result);
      }
    });
  }


  function _findIn(db, bucket, keys) {
    log.trace('storage: findIn: ', bucket, keys);
    return new Promise(function (resolve, reject) {
      var store = db.store(bucket);
      var result = [];
      var current = 0;
      var sKeys = keys.slice();
      sKeys = sKeys.sort(treo.cmp);

      log.trace('storage: findIn: sorted keys: ', sKeys);
      keys.forEach(function (k) {
        result.push({key: k, value: undefined});
      });
      store.cursor({ iterator: iterator }, done);

      function iterator(cursor) {
        log.trace('storage: findIn: iterator: ', cursor);
        if (cursor.key > sKeys[current]) {
          log.trace('storage: cursor ahead: ', cursor.key, sKeys[current]);
          while(cursor.key > sKeys[current] && current < sKeys.length) {
            current += 1;
            log.trace('storage: moving to next key: ', cursor.key, sKeys[current]);
          }
          if(current > sKeys.length) {
            log.trace('storage: exhausted keys. done.');
            return done();
          }
        }
        if (cursor.key === sKeys[current]) {
          log.trace('storage: found key: ', cursor.key);
          result[keys.indexOf(sKeys[current])] = {key: cursor.key, value: cursor.value.value};
          current += 1;
          (current < sKeys.length)?cursor.continue(sKeys[current]):done();
        }
        else {
          log.trace('storage: continuing to next key: ', sKeys[current]);
          cursor.continue(sKeys[current]); // go to next key
        }
      }

      function done(err) {
        log.trace('storage: findIn: result: ', result);
        err ? reject(err) : resolve(result);
      }
    });
  }

  function _getAll(db, bucket, loadValue, index, range) {
    log.trace('storage: _getAll: ', bucket, loadValue, index, range);
    return new Promise(function (resolve, reject) {
      var result = [];
      var keys = [];
      var store = db.store(bucket);
      var opts = {iterator: iterator};
      if(index) {
        opts.index = index;
      }
      if(range) {
        opts.range = range;
      }
      store.cursor(opts, function(err) {
        if(err) {
          reject(err);
        }
        else {
          if(!index && !range && !loadValue) {
            resolve(keys);
          }
          else {
            resolve(result);
          }
        }
      });
      function iterator(cursor) {
        var kv = {key: cursor.primaryKey};
        if(loadValue) {
          kv.value = cursor.value.value;
        }
        if(index) {
          kv.index = cursor.key;
        }
        result.push(kv);
        keys.push(cursor.primaryKey);
        cursor.continue();
      }
    });
  }
  /*****************************************************************
   * External Operations
   *****************************************************************/
  var Private = {};
  var Public = {};

  Private.get =
  Public.get =
  function (params) {
    var db = _db;
    log.trace('storage: get: ', params);
    if (!params.bucket) {
      log.error('storage: get: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if (!params.keys || params.keys.length === 0) {
      return Promise.reject('no keys specified');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      var keys = params.keys.map(function (k) {
        return _siftGuid + '/' + k;
      });
      return _findIn(db, params.bucket, keys).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _findIn(db, params.bucket, params.keys);
  };

  Private.getIndexKeys =
  Public.getIndexKeys =
  function (params) {
    var db = _db;
    log.trace('storage: getIndexKeys: ', params);
    if(!params.bucket) {
      log.error('storage: getIndexKeys: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if(!params.index) {
      return Promise.reject('no index specified');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      return _getAll(db, params.bucket, false, params.index, params.range).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _getAll(db, params.bucket, false, params.index, params.range);
  };

  Private.getIndex =
  Public.getIndex =
  function (params) {
    var db = _db;
    log.trace('storage: getIndex: ', params);
    if(!params.bucket) {
      log.error('storage: getIndex: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if(!params.index) {
      return Promise.reject('no index specified');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      return _getAll(db, params.bucket, true, params.index, params.range).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _getAll(db, params.bucket, true, params.index, params.range);
  };

  Private.getWithIndex =
  Public.getWithIndex =
  function (params) {
    var db = _db;
    log.trace('storage: getWithIndex: ', params);
    if(!params.bucket) {
      log.error('storage: getWithIndex: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if(!params.keys) {
      log.error('storage: getWithIndex: undefined keys');
      return Promise.reject('no keys specified');
    }
    if(!params.index) {
      log.error('storage: getWithIndex: undefined index');
      return Promise.reject('no index specified');
    }
    if(!params.range) {
      log.error('storage: getWithIndex: undefined range');
      return Promise.reject('no range specified');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      var keys = params.keys.map(function (k) {
        return _siftGuid + '/' + k;
      });
      return _getWithIndexRange(db, params.bucket, keys, params.index, params.range).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _getWithIndexRange(db, params.bucket, params.keys, params.index, params.range);
  };

  Private.getAllKeys =
  Public.getAllKeys =
  function (params) {
    var db = _db;
    log.trace('storage: getAllKeys: ', params);
    if (!params.bucket) {
      log.error('storage: getAllKeys: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      return _getAll(db, params.bucket, false).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _getAll(db, params.bucket, false);
  };

  Private.getAll =
  Public.getAll =
  function (params) {
    var db = _db;
    if (!params.bucket) {
      log.error('storage: getAll: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      return _getAll(db, params.bucket, true).then(function (result) {
        return result.map(function (r) {
          return {key: r.key.split('/')[1], value: r.value};
        });
      });
    }
    return _getAll(db, params.bucket, true);
  };

  Private.getUser =
  Public.getUser =
  function (params) {
    params.bucket = USER_BUCKET;
    return Private.get(params);
  };

  Private.put =
  function (params, raw) {
    log.trace('storage: put: ', params, raw);
    var db = _db;
    if (!params.bucket) {
      log.error('storage: put: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if (!params.kvs || params.kvs.length === 0) {
      log.warn('storage: put called with no/empty kvs');
      return Promise.resolve();
    }
    var kvs = params.kvs;
    if(!raw) {
      // Wrap value into a {value: object}
      kvs = kvs.map(function (kv) {
        return {key: kv.key, value: {value: kv.value}};
      });
    }
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      kvs = kvs.map(function (kv) {
        return {key: _siftGuid + '/' + kv.key, value: kv.value};
      });
    }
    return _batchPut(db, params.bucket, kvs);
  };

  Private.putUser =
  Public.putUser =
  function (params) {
    params.bucket = USER_BUCKET;
    if(!params.kvs || params.kvs.length === 0) {
      return Promise.reject('no kvs provided');
    }
    return Private.put(params);
  };

  Private.del =
  function (params) {
    var db = _db;
    if (!params.bucket) {
      log.error('storage: del: undefined bucket');
      return Promise.reject('undefined bucket');
    }
    if (!params.keys || params.keys.length === 0) {
      log.trace('storage: del called with no/empty keys');
      return Promise.resolve();
    }
    var keys = params.keys;
    if(params.bucket === EMAIL_ID_BUCKET || params.bucket === EMAIL_TID_BUCKET) {
      db = _msgDb;
      keys = params.keys.map(function (k) {
        return _siftGuid + '/' + k;
      });
    }
    return _batchDelete(db, params.bucket, keys);
  };

  Public.delUser =
  function (params) {
    params.bucket = USER_BUCKET;
    return Private.del(params);
  };

  Private.deleteDatabase =
  function () {
    return new Promise(function(resolve, reject) {
      _db.drop(function(err) {
        if(!err) {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });
  };

  Private.cursor =
  function (params, done) {
    if (!params.bucket) {
      log.error('storage: getCursor: undefined bucket');
      done('storage: getCursor: undefined bucket');
    }
    else {
      var bucket = _db.store(params.bucket);
      bucket.cursor({iterator: params.iterator}, done);
    }
  };

  Private.db =
  function () {
    return _db;
  };

  Private.msgDb =
  function () {
    return _msgDb;
  };

  Private.setSiftGuid =
  function (guid) {
    return _siftGuid = guid;
  };

  /*****************************************************************
   * Initialisation
   *****************************************************************/
  // define db schema
  function _getTreoSchema(stores, sift) {
    var schema = treo.schema().version(1);
    stores.forEach(function(os) {
      if(!(sift && (SPECIAL_BUCKETS.indexOf(os.name) !== -1))) {
        if(os.keypath) {
          schema = schema.addStore(os.name, {key: os.keypath});
        }
        else {
          schema = schema.addStore(os.name);
        }
        if(os.indexes) {
          os.indexes.forEach(function (idx) {
            schema = schema.addIndex(idx, idx, {unique: false});
          });
        }
      }
    });
    return schema;
  }

  function _getVersionedTreoSchema(versions, sift) {
    var schema = treo.schema();
    versions.forEach(function(stores, i) {
      schema = schema.version(i+1);
      stores.forEach(function(os) {
        if(!(sift && (SPECIAL_BUCKETS.indexOf(os.name) !== -1))) {
          if(os.drop) {
            log.trace('storage: _getVersionedTreoSchema: dropping store: ', os.name);
            schema = schema.dropStore(os.name);
          }
          else if(os.keypath) {
            schema = schema.addStore(os.name, {key: os.keypath});
          }
          else {
            schema = schema.addStore(os.name);
          }
          if(os.indexes) {
            os.indexes.forEach(function (idx) {
              if(os.drop) {
              log.trace('storage: _getVersionedTreoSchema: dropping store/index: ' + os.name + '/' + idx);
                schema = schema.dropIndex(idx);
              }
              else {
                schema = schema.addIndex(idx, idx, {unique: false});
              }
            });
          }
        }
      });
    });
    return schema;
  }

  if(!dbInfo.hasOwnProperty('accountGuid')) {
    log.error('storage: missing required property: dbInfo.accountGuid');
    return null;
  }
  else {
    _accountGuid = dbInfo.accountGuid;
  }
  // Create DBs
  switch(dbInfo.type) {
    case 'MSG':
      _msgDb = treo(MSG_DB_PREFIX + '-' + dbInfo.accountGuid, _getVersionedTreoSchema(MSG_DB_VERSIONED_SCHEMA));
      break;
    case 'SIFT':
      if(!dbInfo.hasOwnProperty('siftGuid')) {
        log.error('storage: missing required property: siftGuid');
        return null;
      }
      else {
        _siftGuid = dbInfo.siftGuid;
      }
      log.trace('storage: creating SIFT db.');
      var schema = _getTreoSchema(dbInfo.schema, true);
      schema = schema.addStore(USER_BUCKET).addStore(REDSIFT_BUCKET);
      _db = treo(_siftGuid + '-' + _accountGuid, schema);
      _msgDb = treo(MSG_DB_PREFIX + '-' + dbInfo.accountGuid, _getVersionedTreoSchema(MSG_DB_VERSIONED_SCHEMA));
      break;
    case 'SYNC':
      log.trace('storage: creating SYNC db.');
      _db = treo(SYNC_DB_PREFIX + '-' + dbInfo.accountGuid, _getTreoSchema(SYNC_DB_SCHEMA));
      break;
    default:
      log.error('storage: unknown db type: ', dbInfo.type);
      return null;
  }

  if(internalUse) {
    log.trace('storage: returning private methods');
    return Private;
  }
  else {
    log.trace('storage: public methods only');
    return Public;
  }
};

/*****************************************************************
 * Exports
 *****************************************************************/
if (typeof module !== 'undefined' && module.exports) { module.exports = TreoStorage; } // CommonJs export
if (typeof define === 'function' && define.amd) { define([], function () { return TreoStorage; }); } // AMD

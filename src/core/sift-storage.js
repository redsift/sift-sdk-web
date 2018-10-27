import Observable from '@redsift/observable';

export default class SiftStorage extends Observable {
  constructor() {
    super();
    this._storage = null;
  }

  init(storage) {
    this._storage = storage;
  }

  get(d) { return this._storage.get(d) }
  getIndexKeys(d) { return this._storage.getIndexKeys(d) }
  getIndex(d) { return this._storage.getIndex(d) }
  getWithIndex(d) { return this._storage.getWithIndex(d) }
  getAllKeys(d) { return this._storage.getAllKeys(d) }
  getAll(d) { return this._storage.getAll(d) }
  getUser(d) { return this._storage.getUser(d) }
  putUser(d) { return this._storage.putUser(d) }
  delUser(d) { return this._storage.delUser(d) }
}

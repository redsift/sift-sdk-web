import Observable from '@redsift/observable';

export default class SiftStorage extends Observable {
  constructor() {
    super();
    this._treo = null;
  }

  init(treo) {
    this._treo = treo;
  }

  get(d){ return this._treo.get(d)}
  getIndexKeys(d){ return this._treo.getIndexKeys(d)}
  getIndex(d){ return this._treo.getIndex(d)}
  getWithIndex(d){ return this._treo.getWithIndex(d)}
  getAllKeys(d){ return this._treo.getAllKeys(d)}
  getAll(d){ return this._treo.getAll(d)}
  getUser(d){ return this._treo.getUser(d)}
  putUser(d){ return this._treo.putUser(d)}
  delUser(d){ return this._treo.delUser(d)}
}

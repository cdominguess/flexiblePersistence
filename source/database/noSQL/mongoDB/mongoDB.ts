/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mongoose, Schema } from 'mongoose';
import { PersistenceAdapter } from './../../../persistenceAdapter/persistenceAdapter';
import { PersistenceInfo } from '../../persistenceInfo';
import { PersistencePromise } from '../../../persistenceAdapter/output/persistencePromise';
import { PersistenceInputCreate } from '../../../persistenceAdapter/input/create/persistenceInputCreate';
import { PersistenceInputUpdate } from '../../../persistenceAdapter/input/update/persistenceInputUpdate';
import { PersistenceInputRead } from '../../../persistenceAdapter/input/read/persistenceInputRead';
import { PersistenceInputDelete } from '../../../persistenceAdapter/input/delete/persistenceInputDelete';
import { Default } from 'default-initializer';

export class MongoDB implements PersistenceAdapter {
  private persistenceInfo: PersistenceInfo;
  private mongooseInstance: Mongoose;
  private genericSchema: Schema;

  element: {
    [name: string]: Default;
  } = {};

  constructor(persistenceInfo: PersistenceInfo) {
    this.persistenceInfo = persistenceInfo;

    this.mongooseInstance = new Mongoose();
    const uri =
      (!persistenceInfo.connectionType ? 'mongodb://' : '') +
      persistenceInfo.uri;

    this.mongooseInstance.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    this.genericSchema = new this.mongooseInstance.Schema(
      {},
      { strict: false }
    );
  }
  correct(
    input: PersistenceInputUpdate<any>
  ): Promise<PersistencePromise<any>> {
    return this.update(input);
  }
  nonexistent(input: PersistenceInputDelete): Promise<PersistencePromise<any>> {
    return this.delete(input);
  }
  existent(
    input: PersistenceInputCreate<any>
  ): Promise<PersistencePromise<any>> {
    return this.create(input);
  }
  create(input: PersistenceInputCreate<any>): Promise<PersistencePromise<any>> {
    if (Array.isArray(input.item)) {
      return this.createArray(input.scheme, input.item, true);
    } else if (Array.isArray(input.item.content)) {
      return this.createArray(input.scheme, input.item);
    } else {
      return this.createItem(input.scheme, input.item);
    }
  }
  update(input: PersistenceInputUpdate<any>): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      return this.updateItem(input.scheme, input.selectedItem, input.item);
    } else {
      return this.updateArray(input.scheme, input.selectedItem, input.item);
    }
  }
  read(input: PersistenceInputRead): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      if (input.id) return this.readItemById(input.scheme, input.id);
      return this.readItem(input.scheme, input.selectedItem);
    } else {
      return this.readArray(input.scheme, input.selectedItem);
    }
  }
  delete(input: PersistenceInputDelete): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      if (input.id) return this.deleteItemById(input.scheme, input.id);
      return this.deleteItem(input.scheme, input.selectedItem);
    } else {
      return this.deleteArray(input.scheme, input.selectedItem);
    }
  }
  updateArray(
    scheme: string,
    selectedItem: any,
    item: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.updateMany(selectedItem, item, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc ? (doc._doc ? doc._doc : doc) : undefined,
              result: result,
              selectedItem: selectedItem,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  public updateItem(
    scheme: string,
    selectedItem: any,
    item: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findOneAndUpdate(selectedItem, item, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc ? (doc as any)._doc : undefined,
              result: result,
              selectedItem: selectedItem,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  public readArray(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.find(selectedItem, (error, doc: Array<any>, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem:
                doc === undefined ? undefined : doc.map((a) => a._doc),
              result: result,
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public readItem(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findOne(selectedItem, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc === undefined ? undefined : doc._doc,
              result: result,
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public readItemById(scheme: string, id): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findById(id, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc === undefined ? undefined : doc._doc,
              result: result,
              selectedItem: { _id: id },
            })
          );
        }
      });
    });
  }

  public deleteArray(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.deleteMany(selectedItem, (error) => {
        if (error) {
          reject(new Error(error));
        } else {
          // console.log('selectedArray :', selectedItem);
          resolve(
            new PersistencePromise({
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public createItem(
    scheme: string,
    item: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.create(item, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc === undefined ? undefined : doc._doc,
              result: result,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  public async createArray(
    scheme: string,
    item: any,
    regular?: boolean
  ): Promise<PersistencePromise<any>> {
    let items: unknown[] = [];
    if (regular) items = item;
    else items = item.content.map((itemC) => ({ ...item, content: itemC }));
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.insertMany(items, (error, docs) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: docs,
              sentItem: items,
            })
          );
        }
      });
    });
  }

  public deleteItem(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findOneAndDelete(selectedItem, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
          // console.log('selectedItem :', selectedItem);
          // console.log('doc :', doc);
          resolve(
            new PersistencePromise({
              receivedItem: doc ? doc['_doc'] : undefined,
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public deleteItemById(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findByIdAndDelete(selectedItem, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
          // console.log('selectedItem :', selectedItem);
          // console.log('doc :', doc);
          resolve(
            new PersistencePromise({
              receivedItem: doc,
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public getPersistenceInfo(): PersistenceInfo {
    return this.persistenceInfo;
  }

  public close(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.mongooseInstance.connection.close((error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(true);
        }
      });
    });
  }
}

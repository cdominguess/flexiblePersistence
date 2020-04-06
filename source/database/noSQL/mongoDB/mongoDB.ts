/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mongoose, Schema } from 'mongoose';
import { PersistenceAdapter } from './../../../persistenceAdapter/persistenceAdapter';
import { DatabaseInfo } from '../../databaseInfo';
import { PersistencePromise } from '../../../persistenceAdapter/persistencePromise';
import { PersistenceInputCreate } from '../../../persistenceAdapter/persistenceInputCreate';
import { PersistenceInputUpdate } from '../../../persistenceAdapter/persistenceInputUpdate';
import { PersistenceInputRead } from '../../../persistenceAdapter/persistenceInputRead';
import { PersistenceInputDelete } from '../../../persistenceAdapter/persistenceInputDelete';

export class MongoDB implements PersistenceAdapter {
  private databaseInfo: DatabaseInfo;
  private mongooseInstance: Mongoose;
  private genericSchema: Schema;

  constructor(databaseInfo: DatabaseInfo) {
    this.databaseInfo = databaseInfo;

    this.mongooseInstance = new Mongoose();
    const uri =
      (!databaseInfo.connectionType ? 'mongodb://' : '') + databaseInfo.uri;

    this.mongooseInstance.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.genericSchema = new this.mongooseInstance.Schema(
      {},
      { strict: false }
    );
  }
  create(input: PersistenceInputCreate): Promise<PersistencePromise> {
    if (input.item instanceof Array) {
      return this.createArray(input.scheme, input.item);
    } else {
      return this.createItem(input.scheme, input.item);
    }
  }
  update(input: PersistenceInputUpdate): Promise<PersistencePromise> {
    if (input.single || input.id) {
      return this.updateItem(input.scheme, input.selectedItem, input.item);
    } else {
      return this.updateArray(input.scheme, input.selectedItem, input.item);
    }
  }
  read(input: PersistenceInputRead): Promise<PersistencePromise> {
    if (input.single || input.id) {
      if (input.id) return this.readItemById(input.scheme, input.id);
      return this.readItem(input.scheme, input.selectedItem);
    } else {
      return this.readArray(input.scheme, input.selectedItem);
    }
  }
  delete(input: PersistenceInputDelete): Promise<PersistencePromise> {
    if (input.single || input.id) {
      if (input.id) return this.deleteItem(input.scheme, input.id);
      return this.deleteItem(input.scheme, input.selectedItem);
    } else {
      return this.deleteArray(input.scheme, input.selectedItem);
    }
  }
  updateArray(
    scheme: string,
    selectedItem: any,
    item: any
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.update(selectedItem, item, (error, doc, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: doc ? doc._doc : undefined,
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
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
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
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.find(selectedItem, (error, doc: Array<any>, result) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem:
                doc === undefined ? undefined : doc.map(a => a._doc),
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
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
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

  public readItemById(scheme: string, id): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
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
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.deleteMany(selectedItem, error => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  public createItem(scheme: string, item: any): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
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
    items: Array<any>
  ): Promise<PersistencePromise> {
    const received = Array<PersistencePromise>();
    for (const item of items) {
      received.push(await this.createItem(scheme, item));
    }
    return new Promise<PersistencePromise>(resolve => {
      resolve(
        new PersistencePromise({
          receivedItem: received.map(({ receivedItem }) => receivedItem),
          result: received.map(({ result }) => result),
          sentItem: received.map(({ sentItem }) => sentItem),
        })
      );
    });
  }

  public deleteItem(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findOneAndDelete(selectedItem, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
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

  public deleteItemById(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.genericSchema);
      model.findByIdAndDelete(selectedItem, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
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

  public getDatabaseInfo(): DatabaseInfo {
    return this.databaseInfo;
  }

  public close(): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      this.mongooseInstance.connection.close(error => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      });
    });
  }
}
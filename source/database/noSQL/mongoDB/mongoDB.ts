/* eslint-disable @typescript-eslint/no-explicit-any */
// file deepcode ignore no-any: any needed
// file deepcode ignore object-literal-shorthand: argh
import { Model, Mongoose, Schema } from 'mongoose';
import { PersistenceAdapter } from './../../../persistenceAdapter/persistenceAdapter';
import { PersistenceInfo } from '../../persistenceInfo';
import { PersistencePromise } from '../../../persistenceAdapter/output/persistencePromise';
// import { Default } from '@flexiblepersistence/default-initializer';
import {
  PersistenceInputUpdate,
  PersistenceInputDelete,
  PersistenceInputCreate,
  PersistenceInputRead,
} from '../../..';
import BaseSchemaDefault from './baseSchemaDefault';

export class MongoDB implements PersistenceAdapter {
  private persistenceInfo: PersistenceInfo;
  private mongooseInstance: Mongoose;

  element: {
    [name: string]: BaseSchemaDefault;
  } = {};

  schema: {
    [name: string]: Schema;
  } = {};

  constructor(
    persistenceInfo: PersistenceInfo,
    element?: {
      [name: string]: BaseSchemaDefault;
    }
  ) {
    this.persistenceInfo = persistenceInfo;

    this.mongooseInstance = new Mongoose();
    const uri =
      (!persistenceInfo.connectionType ? 'mongodb://' : '') +
      persistenceInfo.uri;

    this.mongooseInstance.set('toJSON', {
      virtuals: true,
      transform: (doc, converted) => {
        delete converted._id;
      },
    });

    this.mongooseInstance.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      autoIndex: false,
    });

    if (element) this.setElement(element);

    this.schema['generic'] = new this.mongooseInstance.Schema(
      {
        id: {
          type: Schema.Types.ObjectId,
          unique: true,
          index: true,
        },
      },
      { strict: false, id: true, versionKey: false }
    );
  }

  protected initElement() {
    for (const key in this.element) {
      if (Object.prototype.hasOwnProperty.call(this.element, key)) {
        const element = this.element[key];
        if (!this.schema) this.schema = {};
        this.schema[element.getName()] = new this.mongooseInstance.Schema(
          element.getAttributes(),
          element.getOptions()
        );
        if (element.getIndexOptions())
          this.schema[element.getName()].index(element.getIndexOptions());
      }
    }
  }

  setElement(element: { [name: string]: BaseSchemaDefault }) {
    this.element = element;
    this.initElement();
  }

  getSchema(name: string): Schema {
    if (this.schema[name]) return this.schema[name];
    return this.schema['generic'];
  }
  private clearModel(model: Model<any>): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      model.deleteMany({}, undefined, (error) => {
        if (error) {
          reject(error);
        } else {
          // console.log('selectedArray :', selectedItem);
          resolve(true);
        }
      });
    });
  }
  clear(): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      const responses: Array<Promise<boolean>> = [];
      for (const key in this.mongooseInstance.models) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.mongooseInstance.models,
            key
          )
        ) {
          const model = this.mongooseInstance.models[key];
          responses.push(this.clearModel(model));
        }
      }
      const response = await Promise.all(responses);

      for (const element of response) {
        if (!element) {
          reject(response);
          return;
        }
      }
      resolve(true);
    });
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
      return this.createArray(input.scheme, input.item, true, input.options);
    } else if (Array.isArray(input.item.content)) {
      return this.createArray(input.scheme, input.item, false, input.options);
    } else {
      return this.createItem(input.scheme, input.item);
    }
  }
  update(input: PersistenceInputUpdate<any>): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      return this.updateItem(
        input.scheme,
        input.selectedItem,
        input.item,
        input.options
      );
    } else {
      return this.updateArray(
        input.scheme,
        input.selectedItem,
        input.item,
        input.options
      );
    }
  }
  read(input: PersistenceInputRead): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      if (input.id)
        return this.readItemById(
          input.scheme,
          input.id,
          input.options,
          input.additionalOptions
        );
      return this.readItem(
        input.scheme,
        input.selectedItem,
        input.options,
        input.additionalOptions
      );
    } else {
      return this.readArray(
        input.scheme,
        input.selectedItem,
        input.options,
        input.additionalOptions
      );
    }
  }
  delete(input: PersistenceInputDelete): Promise<PersistencePromise<any>> {
    if (input.single || input.id) {
      if (input.id)
        return this.deleteItemById(input.scheme, input.id, input.options);
      return this.deleteItem(input.scheme, input.selectedItem, input.options);
    } else {
      return this.deleteArray(input.scheme, input.selectedItem, input.options);
    }
  }
  updateArray(
    scheme: string,
    selectedItem: any,
    item: any,
    options: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newItem = this.generateNewItem(item);
      model.updateMany(selectedItem, newItem, options, (error, doc) => {
        if (error) {
          reject(error);
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: this.generateReceivedItem(doc),
              result: doc,
              selectedItem: selectedItem,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  updateItem(
    scheme: string,
    selectedItem: any,
    item: any,
    options: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newItem = this.generateNewItem(item);
      const newSelectedItem = this.generateNewItem(selectedItem);
      model.findOneAndUpdate(
        newSelectedItem,
        newItem,
        options,
        (error, doc, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(
              new PersistencePromise({
                receivedItem: this.generateReceivedItem(doc),
                result: result ? { doc, result } : doc,
                selectedItem: selectedItem,
                sentItem: item,
              })
            );
          }
        }
      );
    });
  }

  readArray(
    scheme: string,
    selectedItem: any,
    options: any,
    additionalOptions: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newSelectedItem = this.generateNewItem(selectedItem);
      model.find(
        newSelectedItem,
        additionalOptions,
        options,
        (error, docs: any[]) => {
          if (error) {
            reject(new Error(error));
          } else {
            const receivedItem = this.generateReceivedArray(docs);
            // console.log(receivedItem);
            resolve(
              new PersistencePromise({
                receivedItem: receivedItem,
                result: docs,
                selectedItem: selectedItem,
              })
            );
          }
        }
      );
    });
  }

  readItem(
    scheme: string,
    selectedItem: any,
    options: any,
    additionalOptions: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newSelectedItem = this.generateNewItem(selectedItem);
      // console.log(newSelectedItem);
      model.findOne(
        newSelectedItem,
        additionalOptions,
        options,
        (error, doc) => {
          if (error) {
            reject(error);
          } else {
            resolve(
              new PersistencePromise({
                receivedItem: this.generateReceivedItem(doc),
                result: doc,
                selectedItem: selectedItem,
              })
            );
          }
        }
      );
    });
  }

  readItemById(
    scheme: string,
    id,
    options: any,
    additionalOptions: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      model.findById(id, additionalOptions, options, (error, doc) => {
        if (error) {
          reject(error);
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: this.generateReceivedItem(doc),
              result: doc,
              selectedItem: { id: id },
            })
          );
        }
      });
    });
  }

  deleteArray(
    scheme: string,
    selectedItem: any,
    options: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newSelectedItem = this.generateNewItem(selectedItem);
      model.deleteMany(newSelectedItem, options, (error) => {
        if (error) {
          reject(error);
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

  private generateReceivedArray(docs: any) {
    let receivedItem;
    if (Array.isArray(docs))
      receivedItem = docs.map((doc) => this.generateReceivedItem(doc));
    else receivedItem = this.generateReceivedItem(docs);
    return receivedItem;
  }

  private generateNewArray(item: any, regular?: boolean) {
    let items = item;
    if (item.content) {
      if (regular)
        items = item.content.map((itemC) => this.generateNewItem(itemC));
      else
        items = item.content.map((itemC) =>
          this.generateNewItem({ ...item, content: itemC, id: itemC.id })
        );
    } else items = item.map((itemC) => this.generateNewItem(itemC));
    // console.log('generateNewArray:', items);

    return items;
  }

  private generateNewItem(item: any) {
    if (item && item.id) {
      const newItem = JSON.parse(JSON.stringify(item));
      newItem._id = newItem.id;
      // console.log('generateNewItem:', newItem.id);
      // delete newItem.id;
      // console.log('generateNewItem:', newItem);
      return newItem;
    }
    // console.log('generateNewItem:', item);
    return item;
  }

  private generateReceivedItem(doc) {
    const receivedItem =
      doc === undefined || doc === null
        ? undefined
        : doc['_doc']
        ? doc['_doc']
        : doc['value']
        ? doc['value']
        : doc;
    if (receivedItem && receivedItem._id) {
      if (!receivedItem.id) receivedItem.id = receivedItem._id;
      delete receivedItem._id;
    }
    return receivedItem;
  }

  createItem(scheme: string, item: any): Promise<PersistencePromise<any>> {
    // console.log('NEW:', item);

    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newItem = this.generateNewItem(item);
      model.create(newItem, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(
            new PersistencePromise({
              receivedItem: this.generateReceivedItem(doc),
              result: doc,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  async createArray(
    scheme: string,
    item: any,
    regular: boolean,
    options: any
  ): Promise<PersistencePromise<any>> {
    const items = this.generateNewArray(item, regular);

    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      model.insertMany(items, options, (error, docs) => {
        if (error) {
          reject(error);
        } else {
          const receivedItem = this.generateReceivedArray(docs);
          // console.log(receivedItem);

          resolve(
            new PersistencePromise({
              receivedItem: receivedItem,
              result: docs,
              sentItem: item,
            })
          );
        }
      });
    });
  }

  deleteItem(
    scheme: string,
    selectedItem: any,
    options: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      const newSelectedItem = this.generateNewItem(selectedItem);
      model.findOneAndDelete(newSelectedItem, options, (error, doc) => {
        if (error) {
          reject(new Error(error));
        } else {
          // console.log('selectedItem :', selectedItem);
          // console.log('doc :', doc);
          resolve(
            new PersistencePromise({
              receivedItem: this.generateReceivedItem(doc),
              result: doc,
              selectedItem: selectedItem,
            })
          );
        }
      });
    });
  }

  deleteItemById(
    scheme: string,
    id: any,
    options: any
  ): Promise<PersistencePromise<any>> {
    return new Promise<PersistencePromise<any>>((resolve, reject) => {
      const model = this.mongooseInstance.model(scheme, this.getSchema(scheme));
      model.findByIdAndDelete(id, options, (error, doc) => {
        if (error) {
          reject(error);
        } else {
          // console.log('selectedItem :', selectedItem);
          // console.log('doc :', doc);
          resolve(
            new PersistencePromise({
              receivedItem: this.generateReceivedItem(doc),
              result: doc,
              selectedItem: { id: id },
            })
          );
        }
      });
    });
  }

  getPersistenceInfo(): PersistenceInfo {
    return this.persistenceInfo;
  }

  close(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.mongooseInstance.connection.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// file deepcode ignore no-any: any needed
export interface PersistenceInputDirectedCreate<Item> {
  single?: boolean;
  item: Item | Item[];
}

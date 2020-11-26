import { Default } from 'default-initializer';
import { PersistenceModifyAdapter } from './persistenceModifyAdapter';
import { PersistenceReadAdapter } from './persistenceReadAdapter';

export interface PersistenceAdapter
  extends PersistenceModifyAdapter,
    PersistenceReadAdapter {
  element: {
    [name: string]: Default;
  };
}

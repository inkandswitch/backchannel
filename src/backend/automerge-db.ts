import Dexie from 'dexie';
import Automerge from 'automerge';
import { DocumentId, ContactId } from './types';
import debug from 'debug';

const MAX_CHANGES_TO_KEEP = 100;

interface SavedChange {
  docId: DocumentId;
  change: Automerge.BinaryChange;
  timestamp: number;
}

interface SavedBinary {
  docId: DocumentId;
  serializedDoc: Automerge.BinaryDocument;
}

interface SavedState {
  docId: DocumentId;
  contactId: ContactId;
  state: Automerge.BinarySyncState;
}

export interface Doc {
  changes: Automerge.BinaryChange[];
  serializedDoc: Automerge.BinaryDocument;
}

export class DB extends Dexie {
  documents: Dexie.Table<SavedBinary, DocumentId>;
  changes: Dexie.Table<SavedChange, DocumentId>;
  states: Dexie.Table<SavedState>;
  private log: debug;

  constructor(dbname) {
    super(dbname);
    this.version(2).stores({
      documents: 'id++,docId',
      changes: 'id++,docId',
      states: 'id++, [docId+contactId], docId',
    });
    this.documents = this.table('documents');
    this.changes = this.table('changes');
    this.states = this.table('states');
    this.log = debug('bc:automerge:db');
  }

  async storeSyncState(
    docId: DocumentId,
    contactId: ContactId,
    state: Automerge.SyncState
  ): Promise<any> {
    let item = await this.states
      .where(['docId', 'contactId'])
      .equals([docId, contactId])
      .first();
    let encodedState = Automerge.Backend.encodeSyncState(state);
    if (item) return this.states.update(item, { state: encodedState });
    else return this.states.add({ docId, contactId, state: encodedState });
  }

  async getSyncState(
    docId: DocumentId,
    contactId: ContactId
  ): Promise<Automerge.SyncState> {
    let item = await this.states.where({ docId, contactId }).first();
    if (item) return Automerge.Backend.decodeSyncState(item.state);
    else return null;
  }

  async storeChange(
    docId: string,
    hash: string,
    change: Automerge.BinaryChange
  ) {
    return this.changes.add({ docId, change, timestamp: Date.now() });
  }

  async getDoc(docId: string): Promise<Doc> {
    let doc = await this.documents.get(docId);
    this.log('getDoc', doc);
    let changes = await this.changes.where({ docId }).toArray();
    return {
      serializedDoc: doc?.serializedDoc,
      changes: changes.map((c) => c.change),
    };
  }

  async saveSnapshot(docId) {
    const { serializedDoc, changes } = await this.getDoc(docId);
    // Bail out of saving snapshot if changes are under threshold
    if (changes.length < MAX_CHANGES_TO_KEEP) return;

    let doc = serializedDoc ? Automerge.load(serializedDoc) : Automerge.init();
    doc = Automerge.applyChanges(doc, changes);

    const lastChangeTime = changes.reduce((max, rec) => {
      let change = Automerge.decodeChange(rec);
      return Math.max(change.time, max);
    }, 0);

    const nextSerializedDoc = Automerge.save(doc);

    let oldChanges = await this.changes.where({ docId });
    let deletable = oldChanges.filter((c) => c.timestamp > lastChangeTime);
    await this.changes.bulkDelete(await deletable.primaryKeys());

    await this.documents.put({
      serializedDoc: nextSerializedDoc,
      docId,
    });
  }

  async destroy() {
    await this.documents.clear();
    await this.changes.clear();
    await this.states.clear();
  }
}

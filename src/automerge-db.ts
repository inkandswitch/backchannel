import Dexie from 'dexie';
import * as Automerge from 'automerge';
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

interface SavedBlob {
  id: string;
  data: Uint8Array;
}

export interface Doc {
  changes: Automerge.BinaryChange[];
  serializedDoc: Automerge.BinaryDocument;
}

export class DB extends Dexie {
  documents: Dexie.Table<SavedBinary, DocumentId>;
  changes: Dexie.Table<SavedChange, DocumentId>;
  states: Dexie.Table<SavedState>;
  blobs: Dexie.Table<SavedBlob, string>;
  private log;

  constructor(dbname) {
    super(dbname);
    this.version(3).stores({
      documents: 'id++,docId',
      changes: 'id++,docId',
      states: 'id++, [docId+contactId]', // compound index on docId and contactId
      blobs: 'id',
    });
    this.documents = this.table('documents');
    this.changes = this.table('changes');
    this.states = this.table('states');
    this.blobs = this.table('blobs');
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

  async storeChange(docId: string, change: Automerge.BinaryChange) {
    return this.changes.add({ docId, change, timestamp: Date.now() });
  }

  async getDoc(docId: string): Promise<Doc> {
    let doc = await this.documents.get(docId);
    let changes = await this.changes.where({ docId }).toArray();
    return {
      serializedDoc: doc?.serializedDoc,
      changes: changes.map((c) => c.change),
    };
  }

  // TODO: not fully tested.
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

    let oldChanges = this.changes.where({ docId });
    let deletable = oldChanges.filter((c) => c.timestamp > lastChangeTime);
    let deleted = this.changes.bulkDelete(await deletable.primaryKeys());
    let add = this.documents.put({
      serializedDoc: nextSerializedDoc,
      docId,
    });
    return Promise.all([add, deleted]);
  }

  async destroy() {
    await this.documents.clear();
    await this.changes.clear();
    await this.states.clear();
  }
}

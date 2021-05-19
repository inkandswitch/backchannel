import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import Automerge from 'automerge'

// The limit of changes to keep before db.saveSnapshot will do serialization
const MAX_CHANGES_TO_KEEP = 100

export class DB {
  db: Promise<IDBPDatabase<any>>
  name: string

  constructor(DB_NAME: string) {
    this.name = DB_NAME
    this.db = openDB(DB_NAME, 7, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Reset db
        const storeNames = db.objectStoreNames
        for (let i = 0; i < storeNames.length; i++) {
          db.deleteObjectStore(storeNames.item(i))
        }

        const changeStore = db.createObjectStore('changes', {
          keyPath: 'hash',
        })
        changeStore.createIndex('docId', 'docId', { unique: false })
        changeStore.createIndex('timestamp', 'timestamp', { unique: false })

        db.createObjectStore('snapshots', {
          keyPath: 'docId',
        })
      },
    })
  }
  async destroy() {
    const db = await this.db
    db.onclose = () => {
      indexedDB.deleteDatabase(this.name)
    }
    await db.close()
  }

  async storeChange(docId: string, hash: string, change: any) {
    const db = await this.db

    await db.add('changes', {
      docId,
      hash,
      change,
      timestamp: Date.now(),
    })
  }

  async getChanges(docId: string) {
    const singleKeyRange = IDBKeyRange.only(docId)
    const db = await this.db
    const values = await db.getAllFromIndex('changes', 'docId', singleKeyRange)
    return values.map((v) => v.change)
  }

  async getDoc(docId: string) {
    const db = await this.db
    // Get latest snapshot if it exists
    const snapshot = await db.get('snapshots', docId)

    // Get outstanding changes
    const singleKeyRange = IDBKeyRange.only(docId)
    const changeRecords = await db.getAllFromIndex(
      'changes',
      'docId',
      singleKeyRange,
    )
    const changes = changeRecords.map((v) => v.change)
    // Calc lastChangeTime
    const lastChangeTime = changeRecords.reduce(
      (max, rec) => Math.max(rec.timestamp, max),
      null,
    )

    return {
      serializedDoc: snapshot?.serializedDoc,
      changes,
      lastChangeTime,
    }
  }

  async saveSnapshot(docId: string) {
    const { serializedDoc, changes, lastChangeTime } = await this.getDoc(docId)
    // Bail out of saving snapshot if changes are under threshold
    if (changes.length < MAX_CHANGES_TO_KEEP) return
    // Create AM doc
    let doc = serializedDoc ? Automerge.load(serializedDoc) : Automerge.init()
    doc = Automerge.applyChanges(doc, changes)
    // Serialize and save with timestamp
    const nextSerializedDoc = Automerge.save(doc)
    const db = await this.db
    await db.put('snapshots', {
      docId,
      serializedDoc: nextSerializedDoc,
      timestamp: Date.now(),
    })
    // Delete changes before lastChangeTime
    const oldChangesKeyRange = IDBKeyRange.upperBound(lastChangeTime)
    const index = db
      .transaction('changes', 'readwrite')
      .store.index('timestamp')

    let cursor = await index.openCursor(oldChangesKeyRange)
    while (cursor) {
      cursor.delete()
      cursor = await cursor.continue()
    }
  }
}
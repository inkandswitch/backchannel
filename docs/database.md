## **Database**

![assets/database.png](assets/database.png)

**Document**

A document is a shared application state. Each user can have a copy of the document locally on several devices (which may belong to the same user, or to different users). Each user can independently update the application state on their local device, even while offline, and save the state to local disk. If the state was changed concurrently on different devices, *Automerge* automatically merges the changes together cleanly, so that everybody ends up in the same state, and no changes are lost.

- *key*. Each document is identified by a strong shared secret, also called a 'pre-shared key.'
- *content.* Refers to the user-generated content as part of the document.
- *metadata.* Refers to any system-generated content not edited directly by the user (e.g. device id, timestamp, vector clock, etc).

**Channel**

A channel is a type of document that represents a linear chat history between two users. The following fields are part of messages in the document. 

- *timestamp:* Clock time that the message was received for display purposes.
- *text:* Text accompanying the message
- *file:*
    - *filename:* The local filename of any content attached to this message.
    - *mimetype:* The mime type of this file.

**Contact Card** 

A contact card is a type of document that represents other users. The following fields are part of messages in the document 'content'. 

- *moniker*. This is a name that represents the contact.
- *channels.* A list of document pointers (*keys)*. A document *key is* a strong shared secret between all participants*.*
- *last_seen (optional):* A timestamp representing the last (local clock) time this contact was seen.
- *public_key* (*optional).* The public key of this contact. This public key could be used to provide end-to-end encryption in later versions of the application.

**System**

- *device_id:* This is a unique randomly-generated identifier for this device. The device_id should only be generated once when the application is opened the first time. This is used for identifying and merging changes between different devices. the *device_id* should be persisted to disk in a location separate from application data to minimize risk of loss.
- *keypair (optional)*: This is a public/private keypair. This can be imported from an existing keyring or generated when the application is opened the first time. The keypair can be overridden or replaced in certain circumstances (e.g., revocation). This keypair could be used to provide end-to-end encryption with contacts in later versions of the application.

**Settings**

The settings object can be accessed and edited by the user.

- *relay_server*: This is the URL to use for relaying data between contacts. By default it uses the magic wormhole relay server. Some users may want to use their own server and this gives them the option to configure this value. *tbd other magic wormhole options. In later version of the application we may expose more magic wormhole options, but first version will only offer the relay server.*
# Backchannel

This project proposes a cross platform desktop application consisting of
a novel combination of out-of-band Identity verification techniques backed by
strong cryptography, and supported by a modernised Pet Name address book
system. This prototype will allow two people to share content safely in
a cohesive, easily understood interface. This prototype will satisfy certain
cases of heightened risk without dramatic configuration or expertise required
on behalf of network participants.

## Questions

- How (and in what context) are identity systems best integrated into local-first software?
- How can we establish an identity system that is more resistant to phishing attacks?
- How can we best balance simplicity, security, and usability?

## Goals

- The solution should resist sociotechnical security attacks. (i.e., phishing, social graph mapping, doxxing, spearfishing, etc)
- The proposed identity system should balance cryptographic and usability/comprehension requirements.
- The solution should a minimalistic protocol design that balances security and simplicity.
- The identity system should be meaningful to the user, but not used conceptually by the user as the primary global name lookup identifier.

## Use cases

- Researchers, theorists and journalists (professional or not) collaborating on cross-field research with NDAs, potentially anonymous sources, or risk of infiltration.
    - This calls for an *autonomous* space for information/file/message sharing, a self-hosted solution articulated around a *petname* system defined by the user, as opposed to a *heteronomous* one, where the conflicting interests of tech actors (intellectual ownership) as well as potential backdoors (on purpose or not) simmer below unsecured *nickname* systems open to social engineering (account id, email address, etc.).
    - There is an initial verification step (e.g., video call or in-person) that establishes a shared secret so that future interactions can be established with higher guarantees this is the same person you spoke to in that initial verification step.
    - This can require a means to write up project updates, status, etc. basically a simple asynchronous mailbox (similar to the late Mailbox) that can fully benefit from a secured *petname* system, not relying on any account id, email address, etc. which can be the target of social engineering.
    - The need for last-minute location sharing between parties for organising, meeting, etc. A code and a time of transmission is known in advance and last-minute intel can be shared via a communication channel that stays open for a short window of time.

## User interaction patterns

- One-to-one between two individuals for review and iteration over time, for instance
  - two researchers exchanging information relating to network security protocols
  - two journalists exchanging material under NDA
- One-to-many
  - between a group and an individual within that group, for instance an essay/white-paper/research/code submitted to other members for review and feedback over time, where the petname system is helpful to identify recurring entities.
  - between an individual (whistleblower/union member) and a structure (newspaper, union).
- One-to-device
  - Professional collaboration requiring the backup of documents to a shared server, without relinquishing their ownership rights to actors like Dropbox and their dodgy terms of service.

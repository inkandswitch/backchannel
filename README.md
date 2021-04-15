# backchannel

Local-first address book.

## What is the problem, and why is it hard?

Digital identity plays a significant role in modern computing. In almost all examples of socially driven computing interactions between two or more users, digital identities rely on user profiles and unique identifiers to help users cognitively recognise and validate their intended recipient or collaborator. 

These digital identity paradigms carry significant risks. Attackers leverage digital identity systems, compromising accounts to impersonate trusted users and manipulating targets into completing tasks or disclosing information. In these cases, a well designed digital identity that features a strong presentational layer is used as a disguise by the attacker. This disguise plays a critical role in the success of the attack, and example of *weaponised design* in which the curatorial user interface is used as a tool to convince a target of an attacker's legitimacy, regardless of the strength of any cryptography.

This rationalist implementation digital identity systems – *I curate, therefore I am* – also assists attackers in the goal of building network graphs of interactions and relationships between individuals. In these instances, the self-curating nature of these identity systems by definition facilitate an ability to perform look-ups of individuals, a requirement for collaboration within a digital identity system but also an effective tool for simple, dragnet unmasking of users within a network and their observable relationships. When combined with web of trust techniques, the effectiveness of these systems as surveillance and mapping tools accelerates exponentially, where declaration of recognition between individuals serves as forensically sound data points for social network analysis for an attacker.

## What is the new technical idea; why can we succeed now?

This project proposes a cross platform desktop application consisting of
a novel combination of out-of-band Identity verification techniques backed by
strong cryptography, and supported by a modernised Pet Name address book
system. This prototype will allow two people to share content safely in
a cohesive, easily understood interface. This prototype will satisfy certain
cases of heightened risk without dramatic configuration or expertise required
on behalf of network participants.

## Developers

[Read the docs](/docs) for more information about how it works and how to get
started contributing!

```
npm install
```

In separate terminals, run 

```
npm run watch
```

```
npm start
```

# Contributors

* Karissa McKelvey, @okdistribute, Lead 
* Ben Royer, Design

# Advisors

* [Cade Diehm](https://shiba.computer/)
* Peter van Hardenberg, @pvh
* سلمان الجماز, @saljam

# License

MIT

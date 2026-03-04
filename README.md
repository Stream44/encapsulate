<table>
  <tr>
    <td><a href="https://Stream44.Studio"><img src=".o/stream44.studio/assets/Icon-v1.svg" width="42" height="42"></a></td>
    <td><strong><a href="https://Stream44.Studio">Stream44 Studio</a></strong><br/>Open Development Project</td>
    <td>Preview release for community feedback.<br/>Get in touch on <a href="https://discord.gg/9eBcQXEJAN">discord</a>.</td>
    <td>Designed by Hand<br/><b>AI assisted Code</a></td>
  </tr>
</table>

⚠️ **Disclaimer:** Under active development. Code has not been audited. APIs and interfaces are subject to change!

encapsulate [![Tests](https://github.com/Stream44/encapsulate/actions/workflows/test.yaml/badge.svg)](https://github.com/Stream44/encapsulate/actions/workflows/test.yaml?query=branch%3Amain)
===

An *experimental* implementation of the [PrivateData.Space](https://privatedata.space) model in TypeScript.

***NOTE:** Not intended for direct use until it matures in light of the projects below.*

It is being used to underpin:
- [Framespace Genesis](https://github.com/Stream44/FramespaceGenesis) - Modeling engine with realtime interactive visualization
- [t44](https://github.com/Stream44/t44) - A web3 + AI ready workspace
- [Stream44.Studio](https://stream44.studio) - A **full-stack IDE** for building **embodied distributed systems**

<p align="center">
  <br/>
  <img src=".o/assets/Hero-Explosion-v0.jpeg" alt="Encapsulate Hero" />
  <br/><br/>
</p>

### Why

When encoding a software system as a body (complete model), the body is structured through the declarative semantic schema and animated by functional processing in nodes.

We need a minimal abstraction to conveniently author graph processing nodes.

`encapsulate` provides such a primitive building block.

![Source To Graph Isomorphism](./docs/SourceToGraphIsomorphism.svg)


The CAPSULE Spine Contract
---

The `encapsulate` library wraps TypeScript objects and binds reference trees for constructing executable component graphs.

The binding rules are defined by **Spine Contracts**. The first *experimental* spine contract is the **Capsule Spine Contract**. It builds a model around **Capsules** which have certain properties.

The capsule spine contract is implemented here: [src/spine-contracts/CapsuleSpineContract.v0/](src/spine-contracts/CapsuleSpineContract.v0/)

### Roadmap

- [ ] Private/Projected properties
- [ ] Property annotations
- [ ] Capsule Projectors
- [ ] Load capsules from packs

Provenance
===

[![Gordian Open Integrity](https://github.com/Stream44/encapsulate/actions/workflows/gordian-open-integrity.yaml/badge.svg)](https://github.com/Stream44/encapsulate/actions/workflows/gordian-open-integrity.yaml?query=branch%3Amain) [![DCO Signatures](https://github.com/Stream44/encapsulate/actions/workflows/dco.yaml/badge.svg)](https://github.com/Stream44/encapsulate/actions/workflows/dco.yaml?query=branch%3Amain)

Repository DID: `did:repo:65bf6c297919ca938c513cdb7517605d0d62cdbf`

<table>
  <tr>
    <td><strong>Inception Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-InceptionLifehash.svg" width="64" height="64"></td>
    <td><strong>Current Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-CurrentLifehash.svg" width="64" height="64"></td>
    <td>Trust established using<br/><a href="https://github.com/Stream44/t44-blockchaincommons.com">Stream44/t44-BlockchainCommons.com</a></td>
  </tr>
</table>

(c) 2026 [Christoph.diy](https://christoph.diy) • Code: [MIT](./LICENSE.txt) • Text: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) • Created with [Stream44.Studio](https://Stream44.Studio)

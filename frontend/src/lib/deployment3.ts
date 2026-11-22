export const deployment = {
  "chainId": 196,
  "contract": "0x9f87c8b20a2d5d63e1d5c96f98f13c12ead08cfe",
  "deployTx": "0x83a6959f091136ce50de3da48888ba9ab9ed80f80605381468a4408837374bb9",
  "processor": "0x7335a50819d44402e3D5E00239bBB80A13E7308F",
  "circuitId": 5,
  "tapeoutTx": "0xfc9e0096116b699c455bdb8ee98bfc16c1984a39675d66050d4002ee081afbee"
} as const;
export const evidenceByTender: Record<string, { note: string; txs: Record<string, string> }> = {
  "1": {
    "note": "Automated mainnet test run with our own test wallets: 39 checks passed, 0 failed. Three evaluators and four bidders (one never revealed). Bidder A won with 99 after the median ignored an outlier score.",
    "txs": {
      "createTender": "0x2156691a46d8639c45c0e7796732b2a444882efa942c9c8d438a6319b1d7aece",
      "commitA": "0x97a54b0cb51b192c72bc26420c9d2952191d27604bf4d8ad0f4e90b0d89bb9f4",
      "commitB": "0xf0bc0552072a1bff8d59d67359837e45caeccb37eb88179e4ed4f701e275ffa1",
      "commitC": "0xecca0dfbbb3bb0ad6ef92bb4b2771e61febfbfb0afc6e8f849a44be2b4a20b9c",
      "commitD": "0x1dc2b7f7d9270863f2d1c9217ced4f297c1c678fc7c1322802cc314673506f9a",
      "revealA": "0x4d82f03cafa5580031b41b6f4dcb97ca7a8113597626a5a9d20a31e1f69e0c12",
      "revealB": "0x6ffdb997ee4f74b39f60e6b05b75f1ddaa514b97fdd8ab646d2c29b7866e4a7f",
      "revealC": "0x62ff38774e7a2ac715e9f8c497421b9f3225fc7a9314a3eb666d7f81641c6ffc",
      "scoreA_E1": "0x5a28fe9b36584737a692a6c9eb9c39c6e97cec2559722b9af6ec63309dfe2424",
      "scoreA_E2": "0x04e541a4364f76c8f458e7bd304f63d96428a25aa17622020e58d4effcd50433",
      "scoreA_E3": "0xb2778cef48d3b1d8ef835df9bd74494aff901cdcd438e360b12c472c91847dee",
      "scoreB_E1": "0xd02f37da93816ea9fd93fff0584f1a7726820dea08c2745af94b530c43202461",
      "scoreB_E2": "0x3182395b4601e0c2a9a31cfb3ba50ce2c05bb1db100eaacc27b14e479c50a6de",
      "scoreB_E3": "0x8f8538a32e078f78e8eefe8491fb452eeacb20a8ac649d1d35d20ef0c86b73df",
      "scoreC_E1": "0xcb1056106f84af81e1cbea163082de672efb2a0c293ff783d0ffbe331b4899b9",
      "scoreC_E2": "0xbe55fb2bc2f0548256dbe59b30de8dc1ad30903325d7916fbff550e10200133c",
      "scoreC_E3": "0xf3136e7b14a86e0ef424a6ee07f335094a88bf6d3fc3c0ae05b98f1fa73c34f3",
      "settleA": "0x6902a3b04ccf8502e7f88fe95268c7728ade281bc0387ebdfe3b1a86d04683af",
      "settleB": "0xd04242d89ee12e03be5336fbeb16a2177f33c6393d72b311cbe1a65c56e960f9",
      "settleC": "0xd0e64df50d5c13d695a8d32f566e8889d354fff44198ab4af21aeff9ca02ced9",
      "finalize": "0x0a22a1fe7527cd9f5260ba7a915c7dcb17ed1fac1efac10ea23b4c4c9594b677"
    }
  },
  "2": {
    "note": "Created and run through the website with separate test wallets: one organizer, three evaluators and two bidders. One evaluator gave an outlier score and the median ignored it.",
    "txs": {
      "createTender": "0xfe6dd0a26175a7ffa75c009f0f1980cab896941ae557527e8a5199967281469d",
      "commit 0xfab7…94d7": "0xe0399da7bdab60c02c4fe8e1ae21a62b71276b5aae6e1432622a48df090db0f3",
      "commit 0x0e09…6f85": "0xe2f032def9d40fe49fccb87808d9773fd321c3b4402c0094749aab7ed9474f5e",
      "reveal 0xfab7…94d7": "0x614dd05d46a3b7f4526266220d3df24322c198ef25cccee7a9aed82e8841f732",
      "reveal 0x0e09…6f85": "0xfd7fa93df8b0a4c63aedbf9aec3b93b5b8c0cf5ea6de45acd2046f2158a42ed4",
      "score 0x60a7…e25a on 0xfab7…94d7": "0x0805a37ae7dd318aa9197afdc783b416b4c4910e58dcb15cab90fb6f015da1c7",
      "score 0x60a7…e25a on 0x0e09…6f85": "0x8b9996011be9b8288dede24abc9e184f30a07d171fea4d5000124cdf37d7d0c5",
      "score 0xdf93…154f on 0xfab7…94d7": "0xa35f4d636f1a2db17469ab535572ef9d90e3a78df8d39c4f5d5b075eb13eff0c",
      "score 0xdf93…154f on 0x0e09…6f85": "0xa3cf14972e4108958f28fac26efbc3dd868548539cbfe1c9e4b7b8e91aec8503",
      "score 0x133b…ce96 on 0xfab7…94d7": "0xe3d60b5428a8d2221c20868d5f94d2283b654a621dd9c1647de251e58e74707c",
      "score 0x133b…ce96 on 0x0e09…6f85": "0x60cf3c045e836b4644970d2ff400ea3bd2f79078f03f6cd3ac73ac562030eb41",
      "settle 0xfab7…94d7": "0x40062ec984e9b575413bf86a161a33ddfea5679c47cadbcd8143836c727d0aab",
      "settle 0x0e09…6f85": "0xf1e4826b9add0e7b39eb743248fa8a34da748ba94be5920dc92b36057b883b24",
      "finalize": "0x4dcb7d8e48debd3178dd1a1e72325d1866f99a887e0342eee6836f3d00a2da5c"
    }
  }
};

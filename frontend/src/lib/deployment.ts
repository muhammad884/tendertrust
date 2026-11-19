export const deployment = {
  "chainId": 196,
  "contract": "0xb6b9c3ca3cb5c2ad02c06eaf1d860e52a96a0543",
  "deployTx": "0x350656e9e0e4ad7068e927c508c254adf28d9a3b44b8333a353b91522cbfb7cf",
  "processor": "0x7335a50819d44402e3D5E00239bBB80A13E7308F",
  "circuitId": 5,
  "tapeoutTx": "0xfc9e0096116b699c455bdb8ee98bfc16c1984a39675d66050d4002ee081afbee",
  "mintTx": "0x16633e09607c7b63c0ff6ddceb94fa81bd1bd96d6ddcea70437ea366f971f7be"
} as const;
export const evidenceByTender = {
  "1": {
    "note": "Demo with our own test wallets (bidders A/B/C). Bidder C was cheapest with top scores but excluded because documents were not verified.",
    "txs": {
      "createTender": "0xa4ab5213fd8c0bca86349abdfb9ea144dfe60edf670a4c0cd92d0b318de807b9",
      "commitA": "0xcf3276bde1037ccee9dd4690480829a183645e63001d0676218f50622bd4fb9c",
      "commitB": "0x08f11e68935350eec7a90c1684947150d52ccb7c3916732a0b3e9e742e25ace7",
      "commitC": "0x913929b7c71684debcd4d49450efd45eb944e274832afbe29f841ac45851ea7d",
      "revealA": "0x574a18b0b516ba431918daa0ece33d3a103f128ebb97754e62a7a108636784b5",
      "revealB": "0x6d077e8f2a0af14b09c95b886ed8ca5adf7012c0eb9d8cf8756b97efbef0c127",
      "revealC": "0xc5edfed2710b2bdc167bf2f31034a958409751e754fe242baac7090c527742a4",
      "evaluateA": "0x3e44e35f99c9a05561ef3cf198aff1f7a3abe1dc5401920e46383f1b411a368e",
      "evaluateB": "0xaf1c83ad247b48f83b3a4449bdf882bab47cc0314961ee855de254439fea0406",
      "evaluateC": "0x925aa31f0600c2afd3f39fce0654b4a86b453cfe78dadbe7669ed01d530ba0b5",
      "finalize": "0x18538a6792d62436b5af525962ff1cd28b1b99230c3af37a424f0dcfcd0e466a"
    }
  },
  "4": {
    "note": "Created and run through the website by separate wallets: one organizer and two bidders.",
    "txs": {
      "createTender": "0x9c3f2c35df422561618fc9147006ed89e8bd9435ba6f57c7ad5ac7d6ddcbb129",
      "commit 0xfab7…94d7": "0x5e46e51db82d55325df450aafcd926961d570f9bd1456e13e0677331c309b5f9",
      "commit 0x0e09…6f85": "0xb8ac338f366a7a2ef7d3e753bf240a2c313e80deff0d3c99a7765f1c4b9378fa",
      "reveal 0xfab7…94d7": "0xc3e59de7a030c70cf89c1834921f6e2bc248404cea674968694388855feea0a5",
      "reveal 0x0e09…6f85": "0xef61dcab02eccf0b893b344eec3d07022194c37a54c8766832f48b3055311d81",
      "evaluate 0xfab7…94d7": "0x9b94750cbc45673d140625cf17773e06ffac59d6740da90213b151e1d77a986a",
      "evaluate 0x0e09…6f85": "0x2a9ed6a9bb3344d6cd125e6e76e0b1416c69ccad985ed62c33e1252056db1c19",
      "finalize": "0x8af0950002ee375a69374b81083081b299ad141c46182892a3f94c39d605495b"
    }
  }
} as const;

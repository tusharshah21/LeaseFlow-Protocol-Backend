const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const app = express();
const port = 3000;
const listings = [];
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon.stellar.org';

app.use(cors());
app.use(express.json());

function hasPositiveTrustline(balances, assetCode, assetIssuer) {
  return balances.some((balance) => {
    const isMatchingAsset =
      balance.asset_code === assetCode &&
      balance.asset_issuer === assetIssuer &&
      String(balance.asset_type || '').startsWith('credit_');

    if (!isMatchingAsset) {
      return false;
    }

    return Number.parseFloat(balance.balance || '0') > 0;
  });
}

async function verifyNftOwnership({ lister, assetCode, assetIssuer }) {
  const response = await fetch(
    `${HORIZON_URL.replace(/\/$/, '')}/accounts/${encodeURIComponent(lister)}`
  );

  if (response.status === 404) {
    return { isOwner: false, reason: 'ACCOUNT_NOT_FOUND' };
  }

  if (!response.ok) {
    throw new Error(`Horizon lookup failed with status ${response.status}`);
  }

  const account = await response.json();
  const balances = Array.isArray(account.balances) ? account.balances : [];

  return {
    isOwner: hasPositiveTrustline(balances, assetCode, assetIssuer),
    reason: 'TRUSTLINE_MISSING_OR_EMPTY',
  };
}

app.get('/', (req, res) => {
  res.json({
    project: 'LeaseFlow Protocol',
    status: 'Active',
    contract_id: 'CAEGD57WVTVQSYWYB23AISBW334QO7WNA5XQ56S45GH6BP3D2AVHKUG4',
  });
});

app.get('/listings', (req, res) => {
  res.json({ listings });
});

app.post('/listings', async (req, res) => {
  const { lister, assetCode, assetIssuer, price, metadata } = req.body || {};

  if (!lister || !assetCode || !assetIssuer || price === undefined || price === null) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['lister', 'assetCode', 'assetIssuer', 'price'],
    });
  }

  try {
    const ownershipCheck = await verifyNftOwnership({ lister, assetCode, assetIssuer });

    if (!ownershipCheck.isOwner) {
      return res.status(403).json({
        error: 'Lister does not own the NFT on-chain',
        reason: ownershipCheck.reason,
      });
    }

    // The repo has no persistent database yet, so this in-memory insert marks the
    // exact point where verified listings would be written once a DB layer exists.
    const listing = {
      id: randomUUID(),
      lister,
      assetCode,
      assetIssuer,
      price,
      metadata: metadata || null,
      createdAt: new Date().toISOString(),
    };

    listings.push(listing);
    return res.status(201).json({ listing });
  } catch (error) {
    return res.status(502).json({
      error: 'Unable to verify ownership against Horizon',
      details: error.message,
    });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`LeaseFlow Backend listening at http://localhost:${port}`);
  });
}

module.exports = {
  app,
  listings,
  resetListings() {
    listings.length = 0;
  },
  verifyNftOwnership,
  hasPositiveTrustline,
};

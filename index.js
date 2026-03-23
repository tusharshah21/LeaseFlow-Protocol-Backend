require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  createConditionProofService,
  ConditionProofError,
} = require('./services/conditionProofService');
const {
  createFileConditionProofStore,
} = require('./services/conditionProofStore');

const port = process.env.PORT || 3000;

function createApp({ conditionProofService } = {}) {
  const app = express();
  const proofService =
    conditionProofService ||
    createConditionProofService({
      store: createFileConditionProofStore(),
    });

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  app.get('/', (req, res) => {
    res.json({
      project: 'LeaseFlow Protocol',
      status: 'Active',
      contract_id: 'CAEGD57WVTVQSYWYB23AISBW334QO7WNA5XQ56S45GH6BP3D2AVHKUG4',
    });
  });

  app.post('/leases/:leaseId/condition-proofs', async (req, res) => {
    try {
      const proof = await proofService.createProof({
        leaseId: req.params.leaseId,
        moveInStartedAt: req.body?.move_in_started_at,
        submittedAt: req.body?.submitted_at,
        note: req.body?.note,
        photos: req.body?.photos,
      });

      res.status(201).json(proof);
    } catch (error) {
      if (error instanceof ConditionProofError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      return res.status(500).json({
        error: 'CONDITION_PROOF_CREATE_FAILED',
        message: 'Unable to record the property condition proof.',
      });
    }
  });

  app.get('/leases/:leaseId/condition-proofs', async (req, res) => {
    try {
      const proofs = await proofService.listProofs(req.params.leaseId);
      res.status(200).json({
        lease_id: req.params.leaseId,
        proofs,
      });
    } catch (error) {
      if (error instanceof ConditionProofError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      return res.status(500).json({
        error: 'CONDITION_PROOF_LIST_FAILED',
        message: 'Unable to load the property condition proofs.',
      });
    }
  });

  app.get('/leases/:leaseId/condition-proofs/arbitration-hook', async (req, res) => {
    try {
      const packet = await proofService.getArbitrationPacket(req.params.leaseId);
      res.status(200).json(packet);
    } catch (error) {
      if (error instanceof ConditionProofError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          details: error.details,
        });
      }

      return res.status(500).json({
        error: 'ARBITRATION_PACKET_BUILD_FAILED',
        message: 'Unable to build the immutable proof of condition packet.',
      });
    }
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(port, () => {
    console.log(`LeaseFlow Backend listening at http://localhost:${port}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.createApp = createApp;

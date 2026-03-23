const request = require('supertest');
const {
  app,
  listings,
  resetListings,
  hasPositiveTrustline,
} = require('../index');

describe('LeaseFlow Backend API', () => {
  beforeEach(() => {
    resetListings();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return 200 and project details on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      project: 'LeaseFlow Protocol',
      status: 'Active',
      contract_id: 'CAEGD57WVTVQSYWYB23AISBW334QO7WNA5XQ56S45GH6BP3D2AVHKUG4',
    });
  });

  it('should require listing fields on POST /listings', async () => {
    const response = await request(app).post('/listings').send({ lister: 'GABC' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Missing required fields',
      required: ['lister', 'assetCode', 'assetIssuer', 'price'],
    });
    expect(listings).toHaveLength(0);
  });

  it('should create a listing when Horizon shows a positive trustline', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          {
            asset_type: 'credit_alphanum12',
            asset_code: 'LEASE-NFT-1',
            asset_issuer: 'GISSUER123',
            balance: '1.0000000',
          },
        ],
      }),
    });

    const response = await request(app).post('/listings').send({
      lister: 'GLISTER123',
      assetCode: 'LEASE-NFT-1',
      assetIssuer: 'GISSUER123',
      price: '1500',
      metadata: { leaseId: 'lease-001' },
    });

    expect(response.status).toBe(201);
    expect(response.body.listing).toMatchObject({
      lister: 'GLISTER123',
      assetCode: 'LEASE-NFT-1',
      assetIssuer: 'GISSUER123',
      price: '1500',
      metadata: { leaseId: 'lease-001' },
    });
    expect(listings).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://horizon.stellar.org/accounts/GLISTER123'
    );
  });

  it('should reject listings when the trustline is missing', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          {
            asset_type: 'native',
            balance: '100.0',
          },
        ],
      }),
    });

    const response = await request(app).post('/listings').send({
      lister: 'GLISTER456',
      assetCode: 'LEASE-NFT-2',
      assetIssuer: 'GISSUER456',
      price: '2200',
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Lister does not own the NFT on-chain',
      reason: 'TRUSTLINE_MISSING_OR_EMPTY',
    });
    expect(listings).toHaveLength(0);
  });

  it('should reject listings when the trustline exists with zero balance', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          {
            asset_type: 'credit_alphanum12',
            asset_code: 'LEASE-NFT-3',
            asset_issuer: 'GISSUER789',
            balance: '0.0000000',
          },
        ],
      }),
    });

    const response = await request(app).post('/listings').send({
      lister: 'GLISTER789',
      assetCode: 'LEASE-NFT-3',
      assetIssuer: 'GISSUER789',
      price: '3000',
    });

    expect(response.status).toBe(403);
    expect(response.body.reason).toBe('TRUSTLINE_MISSING_OR_EMPTY');
    expect(listings).toHaveLength(0);
  });

  it('should reject listings when Horizon account lookup returns 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const response = await request(app).post('/listings').send({
      lister: 'GMISSINGACCOUNT',
      assetCode: 'LEASE-NFT-4',
      assetIssuer: 'GISSUER404',
      price: '3500',
    });

    expect(response.status).toBe(403);
    expect(response.body.reason).toBe('ACCOUNT_NOT_FOUND');
    expect(listings).toHaveLength(0);
  });

  it('should surface Horizon failures without inserting a listing', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const response = await request(app).post('/listings').send({
      lister: 'GUPSTREAMFAIL',
      assetCode: 'LEASE-NFT-5',
      assetIssuer: 'GISSUER500',
      price: '4100',
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: 'Unable to verify ownership against Horizon',
      details: 'Horizon lookup failed with status 503',
    });
    expect(listings).toHaveLength(0);
  });

  it('should detect matching trustlines with positive balances only', () => {
    expect(
      hasPositiveTrustline(
        [
          {
            asset_type: 'credit_alphanum12',
            asset_code: 'LEASE-NFT-6',
            asset_issuer: 'GISSUERTRUST',
            balance: '1.0000000',
          },
          {
            asset_type: 'credit_alphanum12',
            asset_code: 'LEASE-NFT-6',
            asset_issuer: 'GISSUERTRUST',
            balance: '0.0000000',
          },
        ],
        'LEASE-NFT-6',
        'GISSUERTRUST'
      )
    ).toBe(true);

    expect(
      hasPositiveTrustline(
        [
          {
            asset_type: 'credit_alphanum12',
            asset_code: 'LEASE-NFT-6',
            asset_issuer: 'GISSUERTRUST',
            balance: '0.0000000',
          },
        ],
        'LEASE-NFT-6',
        'GISSUERTRUST'
      )
    ).toBe(false);
  });
});

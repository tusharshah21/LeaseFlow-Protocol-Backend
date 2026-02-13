const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    project: 'LeaseFlow Protocol', 
    status: 'Active',
    contract_id: 'CAEGD57WVTVQSYWYB23AISBW334QO7WNA5XQ56S45GH6BP3D2AVHKUG4'
  });
});

app.listen(port, () => {
  console.log(`LeaseFlow Backend listening at http://localhost:${port}`);
});

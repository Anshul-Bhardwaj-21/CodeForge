const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const executeRoute = require('./routes/execute');
const submitRoute = require('./routes/submit');
const problemsRoute = require('./routes/problems');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

app.use('/api/run', executeRoute);
app.use('/api/submit', submitRoute);
app.use('/api/problems', problemsRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

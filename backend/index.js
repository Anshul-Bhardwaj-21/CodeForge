const express = require('express');
const cors = require('cors');

const executeRoute = require('./routes/execute');
const submitRoute = require('./routes/submit');
const problemsRoute = require('./routes/problems');
const progressRoute = require('./routes/progress');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/run', executeRoute);
app.use('/api/submit', submitRoute);
app.use('/api/problems', problemsRoute);
app.use('/api/progress', progressRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

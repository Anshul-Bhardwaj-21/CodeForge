const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const PROBLEMS_DIR = path.join(__dirname, '../../data/problems');

router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(PROBLEMS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(PROBLEMS_DIR);
    const problems = [];
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf8'));
        problems.push({
          id: content.id,
          title: content.title,
          difficulty: content.difficulty,
          tags: content.tags,
          description: content.description
        });
      }
    });

    res.json(problems);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read problems' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const files = fs.readdirSync(PROBLEMS_DIR);
    let found = null;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf8'));
        if (content.id.toString() === req.params.id) {
          // Exclude hidden test cases to prevent cheating
          found = { ...content };
          if (found.test_cases && found.test_cases.hidden_test_cases) {
            delete found.test_cases.hidden_test_cases;
          }
          break;
        }
      }
    }
    
    if (found) {
      res.json(found);
    } else {
      res.status(404).json({ error: 'Problem not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read problem details' });
  }
});

module.exports = router;

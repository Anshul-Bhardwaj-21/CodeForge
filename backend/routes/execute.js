const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '../temp');

router.post('/', async (req, res) => {
  const { language, code, input } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  const jobId = uuidv4();
  
  let sourceFile, executableFile, jobDir;
  let compileCommand, compileArgs;
  let executeCommand, executeArgs;

  if (language === 'cpp') {
    sourceFile = path.join(TEMP_DIR, `${jobId}.cpp`);
    executableFile = path.join(TEMP_DIR, `${jobId}.exe`);
    compileCommand = 'g++';
    compileArgs = [sourceFile, '-o', executableFile];
    executeCommand = executableFile;
    executeArgs = [];
  } else if (language === 'python') {
    sourceFile = path.join(TEMP_DIR, `${jobId}.py`);
    executableFile = null;
    executeCommand = process.platform === 'win32' ? 'python' : 'python3';
    executeArgs = [sourceFile];
  } else if (language === 'java') {
    jobDir = path.join(TEMP_DIR, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir);
    sourceFile = path.join(jobDir, 'Main.java');
    executableFile = path.join(jobDir, 'Main.class');
    compileCommand = 'javac';
    compileArgs = [sourceFile];
    executeCommand = 'java';
    executeArgs = ['-cp', jobDir, 'Main'];
  } else {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  const cleanup = () => {
    try {
      if (sourceFile && fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
      if (executableFile && fs.existsSync(executableFile)) fs.unlinkSync(executableFile);
      if (jobDir && fs.existsSync(jobDir)) fs.rmdirSync(jobDir, { recursive: true });
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  };

  fs.writeFileSync(sourceFile, code);

  const runCode = () => {
    return new Promise((resolve) => {
      const child = spawn(executeCommand, executeArgs);
      let output = '';
      let error = '';

      const timeout = setTimeout(() => {
        child.kill();
        error += '\nTime Limit Exceeded (2s)';
      }, 2000);

      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      } else {
        child.stdin.end();
      }

      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { error += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const isError = code !== 0 || error.includes('Time Limit Exceeded') || error.length > 0;
        resolve({ output, error, status: isError ? 'error' : 'success' });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        error += err.message;
        resolve({ output, error, status: 'error' });
      });
    });
  };

  try {
    if (compileCommand) {
      const compiler = spawn(compileCommand, compileArgs);
      let compileError = '';
      
      compiler.stderr.on('data', (data) => { compileError += data.toString(); });
      compiler.stdout.on('data', (data) => { compileError += data.toString(); });

      compiler.on('close', async (code) => {
        if (code !== 0) {
          cleanup();
          return res.json({ output: '', error: compileError, status: 'error' });
        }
        const result = await runCode();
        cleanup();
        res.json(result);
      });
    } else {
      const result = await runCode();
      cleanup();
      res.json(result);
    }
  } catch (err) {
    cleanup();
    res.status(500).json({ error: 'Execution engine error', details: err.message });
  }
});

module.exports = router;

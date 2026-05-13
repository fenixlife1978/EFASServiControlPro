const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiPath = path.join(root, 'src', 'app', 'api');
const tempPath = path.join(root, 'src', 'app', '__api_temp__');

if (fs.existsSync(tempPath)) {
  fs.renameSync(tempPath, apiPath);
  console.log('API folder restored after build');
} else {
  console.log('Temporary API folder not found, nothing to restore');
}
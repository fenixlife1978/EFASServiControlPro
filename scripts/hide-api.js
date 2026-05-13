const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiPath = path.join(root, 'src', 'app', 'api');
const tempPath = path.join(root, 'src', 'app', '__api_temp__');

if (fs.existsSync(apiPath)) {
  fs.renameSync(apiPath, tempPath);
  console.log('API folder hidden for desktop build');
} else {
  console.log('API folder not found, nothing to hide');
}

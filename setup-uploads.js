const fs = require('fs');
const path = require('path');

const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/verification',
    'uploads/profile_pictures',
    'uploads/services_pictures'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  });
};

module.exports = createUploadDirs; 
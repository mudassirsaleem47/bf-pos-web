const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getSettings, updateSettings, clearData } = require('../controllers/settingController');

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const uploadDir = isVercel
  ? path.join('/tmp', 'uploads/settings')
  : path.join(__dirname, '../../uploads/settings');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Only image files allowed for logo'));
  }
});

router.get('/', getSettings);
router.put('/', upload.single('logo'), updateSettings);
router.delete('/clear-data', clearData);

module.exports = router;

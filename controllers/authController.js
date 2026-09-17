const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { registerStudent, loginUser } = require('../services/authService');

// ── Multer config (local disk — replaced by Cloudinary in Phase 5) ─────────
// NOTE: req.body fields are NOT available inside multer's filename callback
// when using multipart/form-data because multer parses fields and files
// simultaneously. We use a temp unique name here and rename to enrollment
// after the body has been fully parsed in the route handler.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../python/dataset');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // Use a temp name; we'll rename to <enrollment><ext> in the handler
    cb(null, `tmp_${Date.now()}${ext}`);
  },
});

const uploadMulter = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── POST /api/auth/student/register ────────────────────────────────────────
const registerStudentHandler = async (req, res) => {
  const { name, email, enrollment, password } = req.body;
  let renamedFile = null;
  try {
    if (!name || !email || !enrollment || !password) {
      // Clean up the temp file if validation fails
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Rename the temp file to <enrollment><ext> now that body is parsed
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const finalName = enrollment + ext;
      const finalPath = path.join(path.dirname(req.file.path), finalName);
      fs.renameSync(req.file.path, finalPath);
      renamedFile = { ...req.file, filename: finalName, path: finalPath };
    }

    const { token, user } = await registerStudent(
      { name, email, enrollment, password },
      renamedFile  // null if no photo uploaded — photo is optional
    );

    // Trigger face training in background only if a photo was provided
    if (renamedFile) {
      const pythonProcess = spawn(process.env.PYTHON_PATH || 'python', [
        path.join(__dirname, '../python/train_faces.py'),
      ]);
      pythonProcess.stdout.on('data', (d) => console.log(`Python STDOUT: ${d}`));
      pythonProcess.stderr.on('data', (d) => console.error(`Python STDERR: ${d}`));
      pythonProcess.on('close', (code) => console.log(`train_faces.py exited with code ${code}`));
    }

    res.status(201).json({
      success: true,
      message: renamedFile
        ? 'Student registered and face training started'
        : 'Student registered successfully (no photo — face recognition disabled)',
      data: { token, ...user },
    });
  } catch (error) {
    // Clean up renamed file if DB save failed
    if (renamedFile) fs.unlink(renamedFile.path, () => {});
    if (error.code === 11000) {
      // MongoDB duplicate key (email or enrollment already exists)
      return res.status(400).json({ success: false, message: 'Email or Enrollment number already exists' });
    }
    if (error.name === 'ValidationError') {
      // Mongoose field validation failed — extract the first readable message
      const msg = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

// ── POST /api/auth/student/login ────────────────────────────────────────────
const loginStudentHandler = async (req, res) => {
  const { enrollment, password } = req.body;
  try {
    if (!enrollment || !password) {
      return res.status(400).json({ success: false, message: 'Enrollment and password are required' });
    }
    const { token, user } = await loginUser(enrollment, password, 'student');
    res.json({
      success: true,
      message: 'Login successful',
      data: { token, student_id: user._id, name: user.name },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── POST /api/auth/teacher/login ────────────────────────────────────────────
const loginTeacherHandler = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const { token, user } = await loginUser(email, password, 'teacher');
    res.json({
      success: true,
      message: 'Login successful',
      data: { token, teacher_id: user._id, name: user.name },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerStudent: registerStudentHandler,
  loginStudent: loginStudentHandler,
  loginTeacher: loginTeacherHandler,
  uploadMulter,
};

const { spawn } = require('child_process');
const path = require('path');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { saveManualBulk, getByDate } = require('../services/attendanceService');

// ── In-memory handle for the running Python process (Phase 3 removes this) ──
let activePythonProcess = null;

// ── POST /api/teacher/attendance/face ────────────────────────────────────────
const triggerFaceRecognition = async (req, res) => {
  const { subject_id, date } = req.body;
  if (!subject_id || !date) {
    return res.status(400).json({ success: false, message: 'Subject ID and Date are required' });
  }

  try {
    const spawnProcess = () => {
      console.log('Spawning Python face recognition process...');
      activePythonProcess = spawn(process.env.PYTHON_PATH || 'python', [
        path.join(__dirname, '../python/recognize_face.py'),
      ]);

      activePythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        if (global.io) global.io.emit('attendance-error', { message: 'System failed to initialize vision module.' });
      });

      let buffer = '';
      const sessionRecognized = new Set();

      activePythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        lines.forEach(async (line) => {
          if (!line.trim()) return;
          try {
            const parsed = JSON.parse(line);

            if (parsed.type === 'feed' && parsed.recognized && parsed.recognized.length > 0) {
              for (const enrollment of parsed.recognized) {
                const enrollStr = enrollment.toString().trim();
                if (sessionRecognized.has(enrollStr)) continue;
                sessionRecognized.add(enrollStr);

                (async () => {
                  try {
                    const student = await User.findOne({ enrollment: enrollStr, role: 'student' });
                    if (!student) {
                      console.warn(`[FACE] Enrollment "${enrollStr}" not found in MongoDB`);
                      if (global.io) global.io.emit('diagnostic-backend', { msg: `Enrollment "${enrollStr}" not found in DB` });
                      return;
                    }

                    // Upsert attendance — mirror the old ON CONFLICT DO UPDATE
                    await Attendance.findOneAndUpdate(
                      { student: student._id, classId: subject_id, date: new Date(date) },
                      { $set: { status: 'Present', markedBy: 'auto-face' } },
                      { upsert: true }
                    );

                    console.log(`[FACE] Attendance marked for ${student.name}`);
                    if (global.io) global.io.emit('attendance-marked', { name: student.name, enrollment: enrollStr });
                  } catch (dbErr) {
                    console.error('DB Auto-Save Error:', dbErr);
                  }
                })();
              }
            }

            if (global.io) global.io.volatile.emit('attendance-data', parsed);
          } catch (_) {
            // Non-JSON line — ignore
          }
        });
      });

      activePythonProcess.stderr.on('data', (data) => {
        console.error(`Python Runtime Error: ${data}`);
        if (global.io) global.io.emit('attendance-error', { message: data.toString() });
      });

      activePythonProcess.on('close', (code) => {
        console.log(`Python process closed with code ${code}`);
        activePythonProcess = null;
        if (global.io) global.io.emit('attendance-stopped', { code });
      });

      res.json({ success: true, message: 'Recognition started' });
    };

    if (activePythonProcess) {
      activePythonProcess.kill();
      setTimeout(spawnProcess, 500); // Give Windows time to release the camera
    } else {
      spawnProcess();
    }
  } catch (error) {
    console.error('Controller Crash:', error);
    res.status(500).json({ success: false, message: 'Internal system error', error: error.message });
  }
};

// ── POST /api/teacher/attendance/stop ────────────────────────────────────────
const stopFaceRecognition = (req, res) => {
  if (activePythonProcess) {
    activePythonProcess.kill();
    activePythonProcess = null;
    return res.json({ success: true, message: 'Recognition stopped' });
  }
  res.json({ success: false, message: 'No active recognition process' });
};

// ── POST /api/teacher/attendance/manual ──────────────────────────────────────
const saveManualAttendance = async (req, res) => {
  const { subject_id, date, attendance_array } = req.body;
  if (!subject_id || !date || !Array.isArray(attendance_array)) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }
  try {
    await saveManualBulk(subject_id, new Date(date), attendance_array);
    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
};

// ── GET /api/teacher/attendance/fetch ────────────────────────────────────────
const getAttendanceByDate = async (req, res) => {
  const { subject_id, date } = req.query;
  if (!subject_id || !date) {
    return res.status(400).json({ success: false, message: 'Subject ID and Date are required' });
  }
  try {
    const data = await getByDate(subject_id, new Date(date));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance records', error: error.message });
  }
};

// Exposed for the README seed script
const trainFaces = () => {
  const proc = spawn(process.env.PYTHON_PATH || 'python', [path.join(__dirname, '../python/train_faces.py')]);
  proc.stdout.on('data', (d) => console.log(`${d}`));
  proc.stderr.on('data', (d) => console.error(`${d}`));
  proc.on('close', (code) => { console.log(`Training completed with code ${code}`); process.exit(code); });
};

const getActiveProcess = () => activePythonProcess;

module.exports = {
  triggerFaceRecognition,
  stopFaceRecognition,
  saveManualAttendance,
  getAttendanceByDate,
  trainFaces,
  getActiveProcess,
};

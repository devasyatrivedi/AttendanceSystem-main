const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const { getStudentStats } = require('../services/attendanceService');

// ── GET /api/student/dashboard ──────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('name email enrollment photoPath');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student, message: 'Dashboard loaded' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/student/attendance ─────────────────────────────────────────────
const getAttendance = async (req, res) => {
  try {
    const stats = await getStudentStats(req.user.id);
    res.json({ success: true, data: stats, message: 'Attendance fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/student/required ── lectures needed to reach 75% ──────────────
const getRequired = async (req, res) => {
  try {
    const stats = await getStudentStats(req.user.id);

    const requiredData = stats.map((row) => {
      const { total, attended, percentage } = row;
      let needed = 0;
      let statusMsg = 'You are above 75% ✅';

      if (total === 0) {
        statusMsg = 'No classes held yet.';
      } else if (percentage < 75) {
        needed = Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));
        statusMsg = `Attend ${needed} more lectures to reach 75%`;
      }

      return {
        classId: row.classId,
        subject_name: row.subject_name,
        totalClasses: total,
        attendedClasses: attended,
        total,
        attended,
        total_lectures: total,
        attended_lectures: attended,
        count: total,
        percentage,
        needed,
        statusMsg,
      };
    });

    res.json({ success: true, data: requiredData, message: 'Required lectures fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/student/calendar ───────────────────────────────────────────────
const getAttendanceCalendar = async (req, res) => {
  try {
    const records = await Attendance.find({ student: req.user.id })
      .populate('classId', 'name')
      .sort({ date: -1 })
      .lean();

    const data = records.map((r) => ({
      date: r.date,
      status: r.status,
      subject_name: r.classId?.name || 'Unknown',
    }));

    res.json({ success: true, data, message: 'Calendar data fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { getDashboard, getAttendance, getRequired, getAttendanceCalendar };

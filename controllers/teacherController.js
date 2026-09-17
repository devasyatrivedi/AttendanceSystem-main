const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const { sendAbsenceEmail } = require('../services/emailService');

// ── GET /api/teacher/students ────────────────────────────────────────────────
const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name email enrollment photoPath createdAt')
      .lean();
    res.json({ success: true, data: students, message: 'Students fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/teacher/subjects ────────────────────────────────────────────────
const getSubjects = async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user.id }).lean();
    res.json({ success: true, data: classes, message: 'Subjects fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── DELETE /api/teacher/students/:id ──────────────────────────────────────
const deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await User.findOneAndDelete({ _id: id, role: 'student' });
    if (!deleted) return res.status(404).json({ success: false, message: 'Student not found' });
    // Also delete their attendance records
    await Attendance.deleteMany({ student: id });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── POST /api/teacher/subjects ───────────────────────────────────────────────
const createSubject = async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }
    const exists = await Class.findOne({ name: name.trim(), teacher: req.user.id });
    if (exists) return res.status(400).json({ success: false, message: 'Subject already exists' });
    const cls = await Class.create({ name: name.trim(), teacher: req.user.id });
    res.status(201).json({ success: true, data: cls, message: 'Subject created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── DELETE /api/teacher/subjects/:id ────────────────────────────────────────
const deleteSubject = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Class.findOneAndDelete({ _id: id, teacher: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── PUT /api/teacher/students/:id ───────────────────────────────────────────
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, email, enrollment } = req.body;
  try {
    if (!name || !email || !enrollment) {
      return res.status(400).json({ success: false, message: 'Name, email, and enrollment are required' });
    }
    const updated = await User.findByIdAndUpdate(
      id,
      { name, email, enrollment },
      { new: true, runValidators: true }
    ).select('name email enrollment');

    if (!updated) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: updated, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── POST /api/teacher/email/send ─────────────────────────────────────────────
const sendEmail = async (req, res) => {
  const { subject_id, date } = req.body;
  try {
    if (!subject_id || !date) {
      return res.status(400).json({ success: false, message: 'subject_id and date are required' });
    }

    const targetDate = new Date(date);

    // Find absent students for this class/date
    const absentRecords = await Attendance.find({
      classId: subject_id,
      date: targetDate,
      status: 'Absent',
    }).populate('student', 'name email enrollment');

    if (absentRecords.length === 0) {
      return res.json({ success: true, message: 'No absent students found for this date/subject' });
    }

    const cls = await Class.findById(subject_id).lean();
    const subjectName = cls?.name || 'Unknown Subject';

    let sentCount = 0;
    for (const record of absentRecords) {
      const { student } = record;
      // Compute attendance stats for this student in this class
      const total = await Attendance.countDocuments({ student: student._id, classId: subject_id });
      const attended = await Attendance.countDocuments({ student: student._id, classId: subject_id, status: 'Present' });
      const percentage = total === 0 ? 0 : (attended / total) * 100;
      const needed = percentage < 75 ? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25)) : 0;

      await sendAbsenceEmail({
        studentName: student.name,
        email: student.email,
        subjectName,
        date,
        percentage,
        needed,
      });
      sentCount++;
    }

    res.json({ success: true, message: `Emails sent to ${sentCount} absent students successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error sending email', error: error.message });
  }
};

// ── GET /api/teacher/daily-attendance ────────────────────────────────────────
const getDailyAttendance = async (req, res) => {
  const { subject_id, date } = req.query;
  try {
    if (!subject_id || !date) {
      return res.status(400).json({ success: false, message: 'subject_id and date are required' });
    }
    const records = await Attendance.find({
      classId: subject_id,
      date: new Date(date),
      status: 'Absent',
    }).populate('student', 'name email enrollment');

    const cls = await Class.findById(subject_id).lean();

    const data = records.map((r) => ({
      student_name: r.student.name,
      email: r.student.email,
      enrollment: r.student.enrollment,
      subject_name: cls?.name || 'Unknown',
      status: r.status,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/teacher/stats ───────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  const { date } = req.query;
  try {
    const targetDate = new Date(date || new Date().toISOString().split('T')[0]);
    const teacherId = req.user.id;

    const totalStudents = await User.countDocuments({ role: 'student' });

    // Get all classes owned by this teacher
    const myClasses = await Class.find({ teacher: teacherId }).select('_id name').lean();
    const myClassIds = myClasses.map((c) => c._id);

    const todayPresent = await Attendance.countDocuments({
      classId: { $in: myClassIds },
      date: targetDate,
      status: 'Present',
    });
    const todayAbsent = await Attendance.countDocuments({
      classId: { $in: myClassIds },
      date: targetDate,
      status: 'Absent',
    });

    const subjectBreakdown = await Promise.all(
      myClasses.map(async (cls) => {
        const present = await Attendance.countDocuments({ classId: cls._id, date: targetDate, status: 'Present' });
        const absent = await Attendance.countDocuments({ classId: cls._id, date: targetDate, status: 'Absent' });
        return { id: cls._id, name: cls.name, present, absent };
      })
    );

    res.json({
      success: true,
      data: { totalStudents, todayPresent, todayAbsent, subjectBreakdown },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Stats fetch failed', error: error.message });
  }
};

// ── GET /api/teacher/attendance-report ──────────────────────────────────────
const getAttendanceReport = async (req, res) => {
  const { subject_id, date } = req.query;
  try {
    if (!subject_id || !date) {
      return res.status(400).json({ success: false, message: 'subject_id and date are required' });
    }
    const records = await Attendance.find({ classId: subject_id, date: new Date(date) })
      .populate('student', 'name enrollment')
      .sort({ 'student.enrollment': 1 })
      .lean();

    const data = records.map((r) => ({
      enrollment: r.student.enrollment,
      name: r.student.name,
      status: r.status,
      marked_by: r.markedBy,
      created_at: r.createdAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Report fetch failed', error: error.message });
  }
};

// ── GET /api/teacher/monthly-stats ──────────────────────────────────────────
const getMonthlyStats = async (req, res) => {
  const { month, year } = req.query;
  try {
    const teacherId = req.user.id;
    const myClasses = await Class.find({ teacher: teacherId }).select('_id').lean();
    const myClassIds = myClasses.map((c) => c._id);

    const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const endDate = new Date(year, parseInt(month), 0); // last day of month

    const stats = await Attendance.aggregate([
      {
        $match: {
          classId: { $in: myClassIds },
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present_count: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          absent_count: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const data = stats.map((s) => ({
      date: s._id,
      present_count: s.present_count,
      absent_count: s.absent_count,
    }));

    res.json({ success: true, data, message: 'Monthly stats fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getStudents,
  getSubjects,
  createSubject,
  deleteSubject,
  deleteStudent,
  sendEmail,
  getDailyAttendance,
  getDashboardStats,
  getAttendanceReport,
  updateStudent,
  getMonthlyStats,
};

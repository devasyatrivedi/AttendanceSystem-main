const express = require('express');
const {
  getStudents, updateStudent, deleteStudent,
  getSubjects, createSubject, deleteSubject,
  sendEmail, getDailyAttendance, getDashboardStats,
  getAttendanceReport, getMonthlyStats,
} = require('../controllers/teacherController');
const attendanceRoutes = require('./attendanceRoutes');
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(restrictTo('teacher'));

// Student management
router.get('/students', getStudents);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

// Subject management
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.delete('/subjects/:id', deleteSubject);

// Dashboard & reports
router.get('/stats', getDashboardStats);
router.get('/monthly-stats', getMonthlyStats);
router.get('/attendance-report', getAttendanceReport);
router.get('/daily-attendance', getDailyAttendance);

// Email alerts
router.post('/email/send', sendEmail);

// Attendance operations
router.use('/attendance', attendanceRoutes);

module.exports = router;

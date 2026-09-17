const Attendance = require('../models/Attendance');
const User = require('../models/User');

/**
 * Save or update a bulk manual attendance array for a class + date.
 * Replaces the PostgreSQL transaction with Mongoose bulkWrite upserts.
 * @param {string} classId  - ObjectId of the Class document
 * @param {Date}   date     - The attendance date (Date object)
 * @param {Array}  records  - [{ enrollment: 'CS001', status: 'Present' }, ...]
 */
const saveManualBulk = async (classId, date, records) => {
  // Resolve all enrollment numbers to User ObjectIds in one query
  const enrollments = records.map((r) => r.enrollment);
  const students = await User.find({ enrollment: { $in: enrollments }, role: 'student' }, '_id enrollment');

  const enrollToId = {};
  students.forEach((s) => { enrollToId[s.enrollment] = s._id; });

  const ops = records
    .filter((r) => enrollToId[r.enrollment]) // skip unknown enrollments
    .map((r) => ({
      updateOne: {
        filter: { student: enrollToId[r.enrollment], classId, date },
        update: { $set: { status: r.status, markedBy: 'manual' } },
        upsert: true,
      },
    }));

  if (ops.length === 0) return { matched: 0 };
  const result = await Attendance.bulkWrite(ops);
  return result;
};

/**
 * Fetch attendance for a class on a given date.
 * Returns array of { enrollment, status } matching the old API shape.
 */
const getByDate = async (classId, date) => {
  const records = await Attendance.find({ classId, date })
    .populate('student', 'enrollment name')
    .lean();

  return records.map((r) => ({
    enrollment: r.student.enrollment,
    status: r.status,
  }));
};

/**
 * Compute per-class attendance stats for a student.
 * Returns array matching the old { subject_name, total, attended, percentage } shape.
 */
const getStudentStats = async (studentId) => {
  const Class = require('../models/Class');
  const classes = await Class.find({}).lean();

  const stats = await Promise.all(
    classes.map(async (cls) => {
      const total = await Attendance.countDocuments({ student: studentId, classId: cls._id });
      const attended = await Attendance.countDocuments({ student: studentId, classId: cls._id, status: 'Present' });
      const percentage = total === 0 ? 0 : parseFloat(((attended / total) * 100).toFixed(2));
      return {
        classId: cls._id,
        subject_name: cls.name,
        total,
        attended,
        percentage,
      };
    })
  );

  return stats;
};

module.exports = { saveManualBulk, getByDate, getStudentStats };

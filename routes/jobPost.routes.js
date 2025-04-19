const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobPost.controller');
const { authenticateJWT } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateJWT);

// Create a new job post (homeowners only)
router.post('/', jobPostController.createJobPost);

// Get all job posts with filtering options
router.get('/', jobPostController.getJobPosts);

// Get job posts for current homeowner
router.get('/my-posts', jobPostController.getMyJobPosts);

// Get my job applications (for housekeepers)
router.get('/my-applications', jobPostController.getMyApplications);

// Get a single job post by ID
router.get('/:id', jobPostController.getJobPostById);

// Update a job post (homeowners only)
router.put('/:id', jobPostController.updateJobPost);

// Delete a job post (homeowners only)
router.delete('/:id', jobPostController.deleteJobPost);

// Change job post status (pause/resume/archive) (homeowners only)
router.patch('/:id/status', jobPostController.updateJobStatus);

// Apply to a job post (housekeepers only)
router.post('/:id/apply', jobPostController.applyToJob);

// Update applicant status (accept/reject) (homeowners only)
router.patch('/:id/applicants/:applicantId/status', jobPostController.updateApplicantStatus);

module.exports = router; 
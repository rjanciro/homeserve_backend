const JobPost = require('../models/jobPost.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// Create a new job post
exports.createJobPost = async (req, res) => {
  try {
    const { 
      title, description, location, schedule, 
      skills, budget, status
    } = req.body;

    // Check if user is homeowner
    if (req.user.userType !== 'homeowner') {
      return res.status(403).json({ message: 'Only homeowners can create job posts' });
    }

    const newJobPost = new JobPost({
      title,
      description,
      location,
      schedule,
      skills,
      budget,
      status: status || 'active',
      homeownerId: req.user.id,
    });

    const savedJobPost = await newJobPost.save();
    
    res.status(201).json(savedJobPost);
  } catch (error) {
    console.error('Error creating job post:', error);
    res.status(500).json({ message: 'Error creating job post', error: error.message });
  }
};

// Get all job posts with filtering options
exports.getJobPosts = async (req, res) => {
  try {
    const { status, homeownerId, limit = 20, page = 1, skills, location } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    
    // Add filters if provided
    if (status) query.status = status;
    if (homeownerId) query.homeownerId = homeownerId;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      query.skills = { $in: skillsArray };
    }
    
    // For housekeepers, only show active jobs
    if (req.user.userType === 'housekeeper') {
      query.status = 'active';
    }
    
    const total = await JobPost.countDocuments(query);
    const jobPosts = await JobPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('homeownerId', 'firstName lastName profileImage')
      .populate('applicants.userId', 'firstName lastName profileImage');
      
    // Format the output with proper naming
    const formattedJobPosts = jobPosts.map(post => {
      const homeowner = post.homeownerId;
      
      // Format applicants
      const formattedApplicants = post.applicants.map(applicant => {
        const user = applicant.userId;
        return {
          id: applicant._id,
          userId: user._id,
          name: `${user.firstName} ${user.lastName}`,
          rate: applicant.proposedRate,
          status: applicant.status,
          dateApplied: applicant.dateApplied,
          message: applicant.message,
          userImage: user.profileImage
        };
      });
      
      return {
        id: post._id,
        title: post.title,
        description: post.description,
        location: post.location,
        schedule: post.schedule,
        skills: post.skills,
        budget: post.budget,
        status: post.status,
        createdAt: post.createdAt,
        homeownerId: homeowner._id,
        homeownerName: `${homeowner.firstName} ${homeowner.lastName}`,
        homeownerImage: homeowner.profileImage,
        applicants: formattedApplicants,
        hiredPerson: post.hiredPerson
      };
    });
    
    res.status(200).json({
      posts: formattedJobPosts,
      totalPosts: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error getting job posts:', error);
    res.status(500).json({ message: 'Error getting job posts', error: error.message });
  }
};

// Get job posts for current homeowner
exports.getMyJobPosts = async (req, res) => {
  try {
    // Only homeowners can access their job posts
    if (req.user.userType !== 'homeowner') {
      return res.status(403).json({ message: 'Only homeowners can view their job posts' });
    }
    
    const { status, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { homeownerId: req.user.id };
    if (status) query.status = status;
    
    const total = await JobPost.countDocuments(query);
    const jobPosts = await JobPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('applicants.userId', 'firstName lastName profileImage verificationDocuments');
      
    // Format the data
    const formattedJobPosts = jobPosts.map(post => {
      const formattedApplicants = post.applicants.map(applicant => {
        const user = applicant.userId;
        return {
          id: applicant._id,
          userId: user._id,
          name: `${user.firstName} ${user.lastName}`,
          rate: applicant.proposedRate,
          status: applicant.status,
          dateApplied: applicant.dateApplied,
          message: applicant.message,
          userImage: user.profileImage,
          credentials: user.verificationDocuments ? 
            `${user.verificationDocuments.certifications?.verified ? 'Certified' : ''} ${user.verificationDocuments.identificationCard?.verified ? '| ID Verified' : ''}` : 
            '',
          hasId: user.verificationDocuments?.identificationCard?.verified || false,
          hasCertifications: user.verificationDocuments?.certifications?.verified || false
        };
      });
      
      return {
        id: post._id,
        title: post.title,
        description: post.description,
        location: post.location,
        startDate: post.schedule.startDate,
        schedule: post.schedule,
        skills: post.skills,
        budget: post.budget,
        salary: post.budget.type === 'fixed' 
          ? `₱${post.budget.amount}/${post.budget.rate}`
          : `₱${post.budget.minAmount}-${post.budget.maxAmount}/${post.budget.rate}`,
        status: post.status,
        createdAt: post.createdAt,
        applicants: formattedApplicants,
        hiredPerson: post.hiredPerson
      };
    });
    
    res.status(200).json({
      posts: formattedJobPosts,
      totalPosts: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error getting job posts:', error);
    res.status(500).json({ message: 'Error getting job posts', error: error.message });
  }
};

// Get a single job post by ID
exports.getJobPostById = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id)
      .populate('homeownerId', 'firstName lastName profileImage')
      .populate('applicants.userId', 'firstName lastName profileImage');
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }

    // Format the data similar to getJobPosts
    const homeowner = jobPost.homeownerId;
    const formattedApplicants = jobPost.applicants.map(applicant => {
      const user = applicant.userId;
      return {
        id: applicant._id,
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        rate: applicant.proposedRate,
        status: applicant.status,
        dateApplied: applicant.dateApplied,
        message: applicant.message,
        userImage: user.profileImage
      };
    });
    
    const formattedJobPost = {
      id: jobPost._id,
      title: jobPost.title,
      description: jobPost.description,
      location: jobPost.location,
      schedule: jobPost.schedule,
      skills: jobPost.skills,
      budget: jobPost.budget,
      status: jobPost.status,
      createdAt: jobPost.createdAt,
      homeownerId: homeowner._id,
      homeownerName: `${homeowner.firstName} ${homeowner.lastName}`,
      homeownerImage: homeowner.profileImage,
      applicants: formattedApplicants,
      hiredPerson: jobPost.hiredPerson
    };
    
    res.status(200).json(formattedJobPost);
  } catch (error) {
    console.error('Error getting job post:', error);
    res.status(500).json({ message: 'Error getting job post', error: error.message });
  }
};

// Update a job post
exports.updateJobPost = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id);
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }
    
    // Check if user is the owner of the job post
    if (jobPost.homeownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job post' });
    }
    
    // Don't allow modifying applicants or hired person through this endpoint
    const { applicants, hiredPerson, ...updateData } = req.body;
    
    // Don't update these fields
    delete updateData.homeownerId;
    delete updateData.createdAt;
    
    const updatedJobPost = await JobPost.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    
    res.status(200).json(updatedJobPost);
  } catch (error) {
    console.error('Error updating job post:', error);
    res.status(500).json({ message: 'Error updating job post', error: error.message });
  }
};

// Delete a job post
exports.deleteJobPost = async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id);
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }
    
    // Check if user is the owner of the job post
    if (jobPost.homeownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this job post' });
    }
    
    await JobPost.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Job post deleted successfully' });
  } catch (error) {
    console.error('Error deleting job post:', error);
    res.status(500).json({ message: 'Error deleting job post', error: error.message });
  }
};

// Change job post status (pause/resume/archive)
exports.updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const jobPost = await JobPost.findById(req.params.id);
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }
    
    // Check if user is the owner of the job post
    if (jobPost.homeownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job post' });
    }
    
    if (!['active', 'paused', 'hired', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    jobPost.status = status;
    await jobPost.save();
    
    res.status(200).json({ message: 'Job status updated successfully', jobPost });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ message: 'Error updating job status', error: error.message });
  }
};

// Apply to a job post (housekeepers only)
exports.applyToJob = async (req, res) => {
  try {
    const { message, proposedRate } = req.body;
    
    // Check if user is housekeeper
    if (req.user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Only housekeepers can apply to jobs' });
    }
    
    const jobPost = await JobPost.findById(req.params.id);
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }
    
    // Check if job is active
    if (jobPost.status !== 'active') {
      return res.status(400).json({ message: 'Cannot apply to inactive job' });
    }
    
    // Check if already applied
    const alreadyApplied = jobPost.applicants.find(
      applicant => applicant.userId.toString() === req.user.id
    );
    
    if (alreadyApplied) {
      return res.status(400).json({ message: 'You have already applied to this job' });
    }
    
    const newApplication = {
      userId: req.user.id,
      message,
      proposedRate,
      status: 'pending',
      dateApplied: new Date()
    };
    
    jobPost.applicants.push(newApplication);
    await jobPost.save();
    
    // Populate user data for frontend
    const populated = await JobPost.findById(req.params.id)
      .populate('applicants.userId', 'firstName lastName profileImage');
    
    // Get the newly added application
    const newApplicant = populated.applicants[populated.applicants.length - 1];
    const user = newApplicant.userId;
    
    const formattedApplicant = {
      id: newApplicant._id,
      userId: user._id,
      name: `${user.firstName} ${user.lastName}`,
      rate: newApplicant.proposedRate,
      status: newApplicant.status,
      dateApplied: newApplicant.dateApplied,
      message: newApplicant.message,
      userImage: user.profileImage
    };
    
    res.status(201).json({ 
      message: 'Successfully applied to job',
      application: formattedApplicant
    });
  } catch (error) {
    console.error('Error applying to job:', error);
    res.status(500).json({ message: 'Error applying to job', error: error.message });
  }
};

// Update applicant status (accept/reject) - for homeowners
exports.updateApplicantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id, applicantId } = req.params;
    
    // Check if user is homeowner
    if (req.user.userType !== 'homeowner') {
      return res.status(403).json({ message: 'Only homeowners can update applicant status' });
    }
    
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const jobPost = await JobPost.findById(id);
    
    if (!jobPost) {
      return res.status(404).json({ message: 'Job post not found' });
    }
    
    // Check if user is the owner of the job post
    if (jobPost.homeownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job post' });
    }
    
    // Find the applicant
    const applicant = jobPost.applicants.id(applicantId);
    
    if (!applicant) {
      return res.status(404).json({ message: 'Applicant not found' });
    }
    
    // Update applicant status
    applicant.status = status;
    
    // If accepting applicant, update job status to hired and add hired person details
    if (status === 'accepted') {
      // Get user details for hired person
      const user = await User.findById(applicant.userId);
      
      jobPost.status = 'hired';
      jobPost.hiredPerson = {
        userId: applicant.userId,
        startDate: new Date(),
        name: `${user.firstName} ${user.lastName}`
      };
      
      // Set all other applicants to rejected
      jobPost.applicants.forEach(app => {
        if (app._id.toString() !== applicantId) {
          app.status = 'rejected';
        }
      });
    }
    
    await jobPost.save();
    
    res.status(200).json({ 
      message: `Applicant ${status} successfully`,
      jobPost
    });
  } catch (error) {
    console.error('Error updating applicant status:', error);
    res.status(500).json({ message: 'Error updating applicant status', error: error.message });
  }
};

// Get my job applications (for housekeepers)
exports.getMyApplications = async (req, res) => {
  try {
    // Check if user is housekeeper
    if (req.user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Only housekeepers can view their applications' });
    }
    
    const { status, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    // Find job posts where user has applied
    const query = { 'applicants.userId': req.user.id };
    
    if (status) {
      query['applicants.status'] = status;
    }
    
    const jobPosts = await JobPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('homeownerId', 'firstName lastName profileImage');
    
    const total = await JobPost.countDocuments(query);
    
    // Format the data
    const applications = jobPosts.map(post => {
      // Find this user's application in the job post
      const myApplication = post.applicants.find(
        app => app.userId.toString() === req.user.id
      );
      
      const homeowner = post.homeownerId;
      
      return {
        jobId: post._id,
        jobTitle: post.title,
        jobDescription: post.description,
        location: post.location,
        schedule: post.schedule,
        budget: post.budget,
        jobStatus: post.status,
        createdAt: post.createdAt,
        homeownerId: homeowner._id,
        homeownerName: `${homeowner.firstName} ${homeowner.lastName}`,
        homeownerImage: homeowner.profileImage,
        application: {
          id: myApplication._id,
          status: myApplication.status,
          dateApplied: myApplication.dateApplied,
          message: myApplication.message,
          proposedRate: myApplication.proposedRate
        }
      };
    });
    
    res.status(200).json({
      applications,
      totalApplications: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error getting applications:', error);
    res.status(500).json({ message: 'Error getting applications', error: error.message });
  }
}; 
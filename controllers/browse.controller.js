const User = require('../models/user.model');
const Service = require('../models/service.model'); // Make sure you have this model created and imported

exports.getAvailableServicesWithHousekeepers = async (req, res) => {
  try {
    console.log("[Browse Controller] Fetching active housekeepers..."); // Log Start
    const housekeepersData = await User.find({ 
        userType: 'housekeeper', 
        isActive: true 
    }).select('_id firstName lastName profileImage location rating reviewCount bio certifications availability isActive'); 

    // --- Add Detailed Log Here ---
    console.log(`[Browse Controller] Raw data fetched for ${housekeepersData.length} housekeepers.`);
    housekeepersData.forEach(hk => {
      console.log(`  - Raw HK ID ${hk._id}: Bio = "${hk.bio}" (Type: ${typeof hk.bio})`);
    });
    // --- End Detailed Log ---

    if (!housekeepersData || housekeepersData.length === 0) {
      console.log("[Browse Controller] No active housekeepers found."); // Log Empty
      return res.json([]); 
    }

    const housekeeperIds = housekeepersData.map(hk => hk._id);

    console.log("[Browse Controller] Fetching services for housekeeper IDs:", housekeeperIds); // Log Service Fetch
    const services = await Service.find({
      housekeeper: { $in: housekeeperIds },
      isAvailable: true 
    }).populate('housekeeper', '_id'); // Populate only ID, we have details already
    console.log(`[Browse Controller] Found ${services.length} available services.`); // Log Service Count

    console.log("[Browse Controller] Mapping housekeeper data with services..."); // Log Mapping Start
    const housekeepersWithServices = housekeepersData.map(hk => {
        const hkServices = services.filter(s => s.housekeeper._id.equals(hk._id)); 
        
        // Construct the object matching the frontend Housekeeper interface
        const resultObject = {
            id: hk._id, 
            // Combine firstName and lastName into the expected 'name' field
            name: `${hk.firstName || ''} ${hk.lastName || ''}`.trim(), 
            location: hk.location,
            // Ensure availability is included, handle if potentially missing
            availability: hk.availability || 'Not specified', 
            rating: hk.rating || 0, 
            reviewCount: hk.reviewCount || 0, 
            image: hk.profileImage, // Map profileImage to image
            bio: hk.bio,
            certifications: hk.certifications,
            isActive: hk.isActive,
            // You might need to fetch reviews separately if required on this page
            reviews: [], // Defaulting to empty for now
            services: hkServices.map(s => ({
                // Spread service data and ensure 'id' field exists
                ...s.toObject(), 
                id: s._id 
            })) 
        };
        
        // --- Add Log Inside Map ---
        console.log(`  - Mapped HK ID ${resultObject.id}: Bio = "${resultObject.bio}" (Type: ${typeof resultObject.bio})`);
        // --- End Log Inside Map ---
        
        return resultObject;
    // Optionally filter out housekeepers with no available services AFTER mapping
    }).filter(hk => hk.services.length > 0); 

    console.log(`[Browse Controller] Sending ${housekeepersWithServices.length} housekeepers with services.`); // Log Sending
    res.json(housekeepersWithServices);

  } catch (error) {
    console.error('[Browse Controller] Error fetching available services:', error); // Log Error
    res.status(500).json({ message: 'Server error fetching services' });
  }
}; 
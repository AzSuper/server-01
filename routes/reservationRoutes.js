const express = require('express');
const ReservationController = require('../controllers/reservationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All reservation routes require authentication
router.use(authenticateToken);

// Create a new reservation
router.post('/', ReservationController.createReservation);

// Get reservations for a specific client
router.get('/client/:client_id', ReservationController.getClientReservations);

// Get reservations for a specific post (for advertisers)
router.get('/post/:post_id', ReservationController.getPostReservations);

// Check availability for a post
router.get('/availability/:post_id', ReservationController.checkAvailability);

// Get reservation statistics for an advertiser
router.get('/stats/:advertiser_id', ReservationController.getAdvertiserReservationStats);

// Cancel a reservation
router.delete('/:reservation_id', ReservationController.cancelReservation);

module.exports = router;
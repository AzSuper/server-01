const { pool } = require('../config/db');

class Reservation {
    static async createReservation(client_id, post_id) {
        const result = await pool.query(
            'INSERT INTO reservations (client_id, post_id) VALUES ($1, $2) RETURNING *',
            [client_id, post_id]
        );
        return result.rows[0];
    }

    static async getReservationsByClientId(client_id) {
        const result = await pool.query('SELECT * FROM reservations WHERE client_id = $1', [client_id]);
        return result.rows;
    }
}

module.exports = Reservation;

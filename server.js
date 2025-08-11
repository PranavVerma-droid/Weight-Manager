const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'weight_manager.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Weight tracking table
    db.run(`CREATE TABLE IF NOT EXISTS weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        log_date TEXT NOT NULL,
        log_weight REAL,
        log_protein REAL DEFAULT 0,
        log_calories REAL DEFAULT 0,
        log_carbs REAL DEFAULT 0,
        log_fat REAL DEFAULT 0,
        log_misc_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Workouts table
    db.run(`CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        workout_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        exercises TEXT NOT NULL,
        total_exercises INTEGER NOT NULL,
        total_sets INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Create default admin user (password: admin123)
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)`, 
        ['admin@example.com', defaultPassword]);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { id: user.id, email: user.email } });
    });
});

// Weight logs routes
app.get('/api/weight', authenticateToken, (req, res) => {
    db.all('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY log_date ASC', 
        [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/weight', authenticateToken, (req, res) => {
    const { log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info } = req.body;
    
    db.run(`INSERT INTO weight_logs 
        (user_id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID });
        });
});

app.put('/api/weight/:id', authenticateToken, (req, res) => {
    const { log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info } = req.body;
    
    db.run(`UPDATE weight_logs 
        SET log_date = ?, log_weight = ?, log_protein = ?, log_calories = ?, 
            log_carbs = ?, log_fat = ?, log_misc_info = ?
        WHERE id = ? AND user_id = ?`,
        [log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
});

app.delete('/api/weight/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM weight_logs WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Workout routes
app.get('/api/workouts', authenticateToken, (req, res) => {
    db.all('SELECT * FROM workouts WHERE user_id = ? ORDER BY workout_date DESC, start_time DESC', 
        [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/workouts', authenticateToken, (req, res) => {
    const { title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets } = req.body;
    
    // Check if workout already exists
    db.get('SELECT id FROM workouts WHERE user_id = ? AND workout_date = ? AND start_time = ? AND title = ?', 
        [req.user.id, workout_date, start_time, title], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Workout already exists' });
        }
        
        db.run(`INSERT INTO workouts 
            (user_id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ id: this.lastID });
            });
    });
});

app.get('/api/workouts/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM workouts WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Workout not found' });
        }
        res.json(row);
    });
});

app.delete('/api/workouts/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM workouts WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Delete multiple workouts
app.post('/api/workouts/delete-multiple', authenticateToken, (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid workout IDs' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM workouts WHERE id IN (${placeholders}) AND user_id = ?`;
    const params = [...ids, req.user.id];
    
    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, deletedCount: this.changes });
    });
});

// Export data
app.get('/api/export', authenticateToken, (req, res) => {
    const weightPromise = new Promise((resolve, reject) => {
        db.all('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY log_date ASC', 
            [req.user.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const workoutsPromise = new Promise((resolve, reject) => {
        db.all('SELECT * FROM workouts WHERE user_id = ? ORDER BY workout_date DESC', 
            [req.user.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    Promise.all([weightPromise, workoutsPromise])
        .then(([weightData, workoutData]) => {
            res.json({
                weight_logs: weightData,
                workouts: workoutData,
                exported_at: new Date().toISOString()
            });
        })
        .catch(err => {
            res.status(500).json({ error: 'Export failed' });
        });
});

// Import data
app.post('/api/import', authenticateToken, (req, res) => {
    const { weight_logs, workouts } = req.body;
    let importedWeight = 0;
    let importedWorkouts = 0;
    let skippedWeight = 0;
    let skippedWorkouts = 0;

    const importWeight = () => {
        return new Promise((resolve) => {
            if (!weight_logs || weight_logs.length === 0) {
                return resolve();
            }

            let processed = 0;
            weight_logs.forEach(entry => {
                // Check if entry already exists
                db.get('SELECT id FROM weight_logs WHERE user_id = ? AND log_date = ?', 
                    [req.user.id, entry.log_date], (err, existing) => {
                    if (existing) {
                        // Update existing
                        db.run(`UPDATE weight_logs 
                            SET log_weight = ?, log_protein = ?, log_calories = ?, 
                                log_carbs = ?, log_fat = ?, log_misc_info = ?
                            WHERE user_id = ? AND log_date = ?`,
                            [entry.log_weight, entry.log_protein, entry.log_calories, 
                             entry.log_carbs, entry.log_fat, entry.log_misc_info, 
                             req.user.id, entry.log_date], () => {
                            skippedWeight++;
                            processed++;
                            if (processed === weight_logs.length) resolve();
                        });
                    } else {
                        // Insert new
                        db.run(`INSERT INTO weight_logs 
                            (user_id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [req.user.id, entry.log_date, entry.log_weight, entry.log_protein, 
                             entry.log_calories, entry.log_carbs, entry.log_fat, entry.log_misc_info], () => {
                            importedWeight++;
                            processed++;
                            if (processed === weight_logs.length) resolve();
                        });
                    }
                });
            });
        });
    };

    const importWorkouts = () => {
        return new Promise((resolve) => {
            if (!workouts || workouts.length === 0) {
                return resolve();
            }

            let processed = 0;
            workouts.forEach(workout => {
                // Check if workout already exists
                db.get('SELECT id FROM workouts WHERE user_id = ? AND workout_date = ? AND start_time = ? AND title = ?', 
                    [req.user.id, workout.workout_date, workout.start_time, workout.title], (err, existing) => {
                    if (existing) {
                        skippedWorkouts++;
                        processed++;
                        if (processed === workouts.length) resolve();
                    } else {
                        // Insert new
                        db.run(`INSERT INTO workouts 
                            (user_id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [req.user.id, workout.title, workout.workout_date, workout.start_time, 
                             workout.duration_minutes, workout.exercises, workout.total_exercises, workout.total_sets], () => {
                            importedWorkouts++;
                            processed++;
                            if (processed === workouts.length) resolve();
                        });
                    }
                });
            });
        });
    };

    importWeight()
        .then(() => importWorkouts())
        .then(() => {
            res.json({
                success: true,
                imported: {
                    weight_logs: importedWeight,
                    workouts: importedWorkouts
                },
                skipped: {
                    weight_logs: skippedWeight,
                    workouts: skippedWorkouts
                }
            });
        })
        .catch(err => {
            res.status(500).json({ error: 'Import failed' });
        });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});